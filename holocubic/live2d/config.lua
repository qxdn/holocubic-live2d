local M = {}

local DEFAULTS = {
  api_url = "http://127.0.0.1:3000/api/v1/chat/completions",
  character_id = "deepseek-whale",
  timeout_ms = 60000,
}

function M.load(directory)
  local config = {
    api_url = DEFAULTS.api_url,
    character_id = DEFAULTS.character_id,
    timeout_ms = DEFAULTS.timeout_ms,
  }
  local raw = file.getcontents(directory .. "/config.json")
  if not raw then return config end
  local ok, value = pcall(sjson.decode, raw)
  if not ok or type(value) ~= "table" then return config end

  if type(value.api_url) == "string" and value.api_url:match("^https?://") then
    config.api_url = value.api_url
  end
  if type(value.character_id) == "string" and value.character_id ~= "" then
    config.character_id = value.character_id
  end
  local timeout = tonumber(value.timeout_ms)
  if timeout and timeout > 0 then
    config.timeout_ms = math.min(120000, math.floor(timeout))
  end
  return config
end

return M
