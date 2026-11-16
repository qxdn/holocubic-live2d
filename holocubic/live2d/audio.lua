local M = {}

function M.create()
  -- The firmware exposes port 0 rather than a Lua stream handle.
  local self = { port = 0, mode = nil, config = nil, generation = 0 }

  function self.stop(mode)
    -- A late ASR disconnect must never stop an ongoing TTS stream.
    if not self.mode or (mode and self.mode ~= mode) then return end
    self.generation = self.generation + 1
    self.mode, self.config = nil, nil
    i2s.stop(self.port)
  end

  function self.start(mode, callback)
    assert(mode == "rx" or mode == "tx", "invalid audio mode")
    assert(not self.mode, "audio port is already in use")
    local config = {
      mode = i2s.MODE_MASTER + (mode == "rx" and i2s.MODE_RX or i2s.MODE_TX),
      rate = mode == "rx" and 16000 or 24000,
      bits = 16, channel = i2s.CHANNEL_ONLY_LEFT, format = i2s.FORMAT_I2S,
      buffer_count = mode == "rx" and 4 or 12,
      buffer_len = mode == "rx" and 512 or 1024,
    }
    if mode == "tx" then config.data_out_pin = 48 end
    self.generation = self.generation + 1
    local generation = self.generation
    local ok, err = pcall(i2s.start, self.port, config, function(port, direction)
      if self.generation == generation and self.mode == mode and direction == mode then
        callback(port, direction)
      end
    end)
    if not ok or err == false then
      self.generation = self.generation + 1
      pcall(i2s.stop, self.port)
      error(tostring(err))
    end
    self.mode, self.config = mode, config
  end

  return self
end

return M
