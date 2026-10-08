// Dictation helper: the Mac's own speech recognizer (Speech.framework, on-device when the locale supports it)
// streamed as JSON lines on stdout. One process per dictation session; the parent writes "stop" on stdin
// (or sends SIGTERM) to finish. Built by scripts/build-dictate.js into bin/dictate; the embedded Info.plist
// carries the usage strings the Speech framework insists on.
//
//   dictate [locale]        stream  {"t":"ready"} {"t":"partial","text":…} {"t":"final","text":…} {"t":"level","v":0…1}
//                                   {"t":"note","msg":…} {"t":"error","msg":…} {"t":"denied","what":"microphone"|"speech"} {"t":"end"}
//   dictate --status        print   {"speech":"authorized"|…, "microphone":"authorized"|…, "onDevice":true|false} and exit
//
// Permissions belong to the responsible process: the packaged app (its Info.plist carries the usage strings).
// A dev run from a terminal would make the terminal responsible and crash here, so with DICTATE_DISCLAIM=1 the
// helper re-executes itself disclaiming that responsibility and becomes its own principal (prompts then name
// "dictate" and read the embedded Info.plist).
import Foundation
import AVFoundation
import Speech

func emit(_ d: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: d) else { return }
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write("\n".data(using: .utf8)!)
}
func authName(_ s: SFSpeechRecognizerAuthorizationStatus) -> String {
  switch s { case .authorized: return "authorized"; case .denied: return "denied"; case .restricted: return "restricted"; default: return "notDetermined" }
}
func micName(_ s: AVAuthorizationStatus) -> String {
  switch s { case .authorized: return "authorized"; case .denied: return "denied"; case .restricted: return "restricted"; default: return "notDetermined" }
}

@_silgen_name("responsibility_spawnattrs_setdisclaim") func responsibility_spawnattrs_setdisclaim(_ attrs: UnsafeMutablePointer<posix_spawnattr_t?>, _ disclaim: Int32) -> Int32
func log(_ m: String) { FileHandle.standardError.write((m + "\n").data(using: .utf8)!) }
let env = ProcessInfo.processInfo.environment
if env["DICTATE_DISCLAIM"] == "1" && env["DICTATE_DISCLAIMED"] == nil, let exe = Bundle.main.executableURL?.path {
  var attr: posix_spawnattr_t? = nil
  posix_spawnattr_init(&attr)
  _ = responsibility_spawnattrs_setdisclaim(&attr, 1)
  posix_spawnattr_setflags(&attr, Int16(POSIX_SPAWN_SETEXEC))
  var argv: [UnsafeMutablePointer<CChar>?] = CommandLine.arguments.map { strdup($0) }; argv.append(nil)
  var envp: [UnsafeMutablePointer<CChar>?] = env.merging(["DICTATE_DISCLAIMED": "1"]) { $1 }.map { strdup("\($0.key)=\($0.value)") }; envp.append(nil)
  let rc = posix_spawn(nil, exe, nil, &attr, argv, envp) // with SETEXEC this replaces the process and never returns on success
  log("disclaim re-exec failed (\(rc)); continuing as a child of the launcher")
}

let args = Array(CommandLine.arguments.dropFirst())
let localeId = args.first(where: { !$0.hasPrefix("--") }) ?? Locale.current.identifier
let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeId)) ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US")) ?? SFSpeechRecognizer()

if args.contains("--status") {
  emit(["speech": authName(SFSpeechRecognizer.authorizationStatus()), "microphone": micName(AVCaptureDevice.authorizationStatus(for: .audio)), "onDevice": recognizer?.supportsOnDeviceRecognition ?? false, "locale": recognizer?.locale.identifier ?? ""])
  exit(0)
}
guard let recognizer = recognizer else { emit(["t": "error", "msg": "No speech recognizer"]); exit(1) }

// Segments: the recognizer keeps growing one transcription per request; after a pause (no change for `settle`
// seconds) the text so far is committed as a final segment and a fresh request starts, so long dictation
// never hits the recognizer's per-request limit and the editor receives text sentence by sentence.
final class Dictator {
  let recognizer: SFSpeechRecognizer
  init(_ r: SFSpeechRecognizer) { recognizer = r }
  let engine = AVAudioEngine()
  var request: SFSpeechAudioBufferRecognitionRequest?
  var task: SFSpeechRecognitionTask?
  var gen = 0
  var text = ""
  var changed = Date(), began = Date()
  var timer: Timer?
  var stopping = false
  var onDevice = false, failures = 0, firstFailure = Date(), gotResult = false, lastLevel = Date(), levelPeak: Float = 0
  var heard = false, silentSince = Date(), silenceNoted = false, voiced: TimeInterval = 0, lastBuffer = Date()
  let settle: TimeInterval = 1.5, cap: TimeInterval = 50

  func start() {
    SFSpeechRecognizer.requestAuthorization { status in
      guard status == .authorized else { emit(["t": "denied", "what": "speech"]); exit(2) }
      AVCaptureDevice.requestAccess(for: .audio) { ok in
        guard ok else { emit(["t": "denied", "what": "microphone"]); exit(3) }
        DispatchQueue.main.async { self.run() }
      }
    }
  }
  func run() {
    let input = engine.inputNode
    let format = input.inputFormat(forBus: 0)
    log("input format: \(format)")
    guard format.sampleRate > 0, format.channelCount > 0 else { emit(["t": "error", "msg": "No microphone"]); exit(4) }
    input.installTap(onBus: 0, bufferSize: 2048, format: format) { [weak self] buffer, _ in
      guard let self = self else { return }
      self.request?.append(buffer)
      // input level, so the app can show that the microphone hears something (peak RMS, at most every 150 ms)
      if let d = buffer.floatChannelData?[0] {
        let n = Int(buffer.frameLength); var sum: Float = 0; for i in 0..<n { sum += d[i] * d[i] }
        let rms = n > 0 ? (sum / Float(n)).squareRoot() : 0; self.levelPeak = max(self.levelPeak, rms)
        if rms > 0 { self.heard = true }
        if rms > 0.01 { self.voiced += Double(n) / format.sampleRate } // seconds of speech-level audio in this request
        if Date().timeIntervalSince(self.lastLevel) > 0.15 { self.lastLevel = Date(); let v = min(1, self.levelPeak * 20); self.levelPeak = 0; emit(["t": "level", "v": Double(round(v * 100) / 100)]) }
      }
    }
    engine.prepare()
    do { try engine.start() } catch { emit(["t": "error", "msg": error.localizedDescription]); exit(4) }
    onDevice = recognizer.supportsOnDeviceRecognition
    log("recognizer \(recognizer.locale.identifier) onDevice=\(onDevice) available=\(recognizer.isAvailable)")
    emit(["t": "ready", "onDevice": onDevice, "locale": recognizer.locale.identifier])
    begin()
    timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in self?.tick() }
  }
  func begin() {
    let r = SFSpeechAudioBufferRecognitionRequest()
    r.shouldReportPartialResults = true
    r.taskHint = .dictation
    if onDevice { r.requiresOnDeviceRecognition = true }
    if #available(macOS 13, *) { r.addsPunctuation = true }
    gen += 1
    let g = gen
    request = r; text = ""; changed = Date(); began = Date(); voiced = 0
    task = recognizer.recognitionTask(with: r) { [weak self] result, error in DispatchQueue.main.async { // one thread for state: results, timer and stop all run on main
      guard let self = self, g == self.gen else { return }
      if let result = result {
        let t = result.bestTranscription.formattedString
        if t != self.text { self.text = t; self.changed = Date(); self.gotResult = true; emit(["t": "partial", "text": t]) }
        if result.isFinal { self.commit() }
        return
      }
      if let error = error { self.failed(error as NSError) }
    } }
  }
  // Recognizers end a request on their own (silence, length): keep the words we have and listen again. A request
  // that keeps failing before any result is reported; when on-device recognition is what fails (its language
  // assets may be missing) the next request goes to Apple's servers instead.
  func failed(_ e: NSError) {
    log("recognizer error: \(e.domain) \(e.code) \(e.localizedDescription)")
    // kLSRErrorDomain 201: macOS Dictation (System Settings → Keyboard) is off; nothing works until it is on.
    if e.domain == "kLSRErrorDomain" && e.code == 201 { emit(["t": "error", "code": "dictation-off", "msg": "Dictation is off in System Settings"]); stop(); return }
    let benign = e.code == 1110 || e.code == 216 || e.code == 203 // no speech detected / cancelled / retry
    if !benign && !gotResult {
      if Date().timeIntervalSince(firstFailure) > 10 { failures = 0; firstFailure = Date() }
      failures += 1
      if failures >= 3 {
        if onDevice { onDevice = false; failures = 0; emit(["t": "note", "msg": "On-device recognition unavailable"]) }
        else { emit(["t": "error", "msg": "Speech recognition failed (\(e.code))"]); stop() }
      }
    }
    commit()
  }
  func commit() {
    let t = text.trimmingCharacters(in: .whitespaces) // newlines stay: a spoken "new paragraph" arrives as "\n\n"
    gen += 1
    task?.cancel(); task = nil
    request?.endAudio(); request = nil
    text = ""
    if !t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { emit(["t": "final", "text": t]) }
    if !stopping { begin() }
  }
  func tick() {
    let now = Date()
    // A microphone that delivers only zeros (lid closed, muted, wrong device) is reported, since nothing else would say so.
    if !heard && !silenceNoted && now.timeIntervalSince(silentSince) > 3 { silenceNoted = true; emit(["t": "note", "msg": "Microphone is silent"]) }
    // Speech-level audio for a while with no result at all: on-device assets may be missing — try Apple's servers, then give up.
    if voiced > 6 && !gotResult {
      voiced = 0
      if onDevice { onDevice = false; emit(["t": "note", "msg": "On-device recognition unavailable"]); commit() }
      else { emit(["t": "error", "msg": "Speech recognition returned nothing"]); stop() }
    }
    if !text.isEmpty && now.timeIntervalSince(changed) > settle { commit() }
    else if now.timeIntervalSince(began) > cap { commit() }
  }
  func stop() {
    if stopping { return }
    stopping = true
    timer?.invalidate()
    let t = text.trimmingCharacters(in: .whitespaces)
    gen += 1
    task?.cancel(); task = nil
    request?.endAudio(); request = nil
    engine.inputNode.removeTap(onBus: 0)
    engine.stop()
    if !t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { emit(["t": "final", "text": t]) }
    emit(["t": "end"])
    exit(0)
  }
}

let dictator = Dictator(recognizer)
// "stop" (or EOF) on stdin ends the session gracefully; SIGTERM does the same.
DispatchQueue.global().async {
  while let line = readLine() { if line.trimmingCharacters(in: .whitespacesAndNewlines) == "stop" { break } }
  DispatchQueue.main.async { dictator.stop() }
}
signal(SIGTERM, SIG_IGN)
let term = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
term.setEventHandler { dictator.stop() }
term.resume()
signal(SIGINT, SIG_IGN)
let intr = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
intr.setEventHandler { dictator.stop() }
intr.resume()

dictator.start()
RunLoop.main.run()
