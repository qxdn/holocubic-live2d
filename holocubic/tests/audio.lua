-- Run from the repository root with Lua 5.3+.
local callbacks, starts, stops = {}, 0, 0
local reject_start = false
i2s = { MODE_MASTER = 1, MODE_RX = 2, MODE_TX = 4, CHANNEL_ONLY_LEFT = 1, FORMAT_I2S = 1 }
function i2s.start(port, config, callback)
  assert(port == 0 and config.bits == 16)
  if reject_start then error("start failed") end
  if config.rate == 16000 then
    assert(config.buffer_count == 4 and config.buffer_len == 512 and not config.data_out_pin)
  else
    assert(config.rate == 24000 and config.data_out_pin == 48)
    assert(config.buffer_count == 12 and config.buffer_len == 1024)
  end
  starts = starts + 1
  callbacks[#callbacks + 1] = callback
end
function i2s.stop(port) assert(port == 0); stops = stops + 1 end
local audio = dofile("holocubic/live2d/audio.lua").create()
local rx, tx = 0, 0
audio.start("rx", function() rx = rx + 1 end)
callbacks[1](0, "rx")
assert(rx == 1 and audio.mode == "rx")
assert(not pcall(audio.start, "tx", function() end), "never replace a live owner silently")
audio.stop("rx")
audio.start("tx", function() tx = tx + 1 end)
callbacks[1](0, "rx")
callbacks[2](0, "rx")
callbacks[2](0, "tx")
assert(rx == 1 and tx == 1, "ignore stale and wrong-direction callbacks")
audio.stop("rx")
assert(audio.mode == "tx" and stops == 1, "ASR cleanup must not stop TTS")
audio.stop("tx")
audio.stop("tx")
assert(stops == 2 and audio.mode == nil and audio.config == nil)
audio.start("rx", function() rx = rx + 1 end)
callbacks[1](0, "rx")
callbacks[3](0, "rx")
assert(rx == 2, "callbacks from an earlier RX session must remain invalid")
audio.stop("rx")
reject_start = true
assert(not pcall(audio.start, "tx", function() end))
assert(audio.mode == nil and audio.config == nil)
reject_start = false
audio.start("tx", function() tx = tx + 1 end)
callbacks[#callbacks](0, "tx")
assert(tx == 2 and starts == 4, "a failed start must not poison the next session")
audio.stop("tx")
print("PASS: shared I2S ownership, RX/TX transitions, stale callbacks, failed start recovery")

local client
app = { exiting = function() return false end }
tmr = { ALARM_SINGLE = 0, time = function() return 0 end }
function tmr.create()
  return { alarm = function() end, unregister = function() end }
end
sjson = { decode = function() return { type = "ready" } end }
websocket = { BINARY = 2 }
function websocket.createClient()
  client = { callbacks = {} }
  function client:on(event, callback) self.callbacks[event] = callback end
  function client:connect() self.callbacks.connection() end
  function client:close() self.callbacks.close() end
  return client
end
local view = { set_status = function() end, set_hint = function() end }
local state = { stopped = false, busy = false }
local speech = dofile("holocubic/live2d/speech.lua").create(state, {
  api_url = "http://server/api/v1/chat/completions", character_id = "whale",
}, view, audio, function() end)
speech.start()
client.callbacks.receive("ready")
assert(audio.mode == "rx")
speech.pause()
audio.start("tx", function() end)
local stops_before_disconnect = stops
client.callbacks.close()
speech.clean()
assert(audio.mode == "tx" and stops == stops_before_disconnect,
  "speech disconnect and cleanup during TTS must leave TX running")
audio.stop("tx")
speech.start()
client.callbacks.receive("ready")
assert(audio.mode == nil, "reconnecting while paused must not restart the microphone")
speech.resume()
assert(audio.mode == "rx")
state.stopped = true
speech.clean()
assert(audio.mode == nil)
print("PASS: ASR reconnect during TTS and microphone resume through the shared audio instance")
