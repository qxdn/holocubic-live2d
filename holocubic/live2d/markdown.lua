local M = {}

local function hide_tag(text, name)
  local opening = "<" .. name .. ">"
  text = text:gsub(opening .. ".-</" .. name .. ">", "")
  text = text:gsub(opening .. ".*$", "")
  for length = 1, #opening - 1 do
    local prefix = opening:sub(1, length)
    if text:sub(-length):lower() == prefix then
      text = text:sub(1, #text - length)
      break
    end
  end
  return text
end

-- Small-screen plain text; keep the original Markdown in conversation history.
function M.to_text(value)
  local text = value:gsub("\r\n", "\n")
  text = hide_tag(text, "think")
  text = hide_tag(text, "motion")
  -- Text imitating a tool call is not an executable client instruction.
  text = text:gsub("%[tool:[^%]]*%]", "")
  text = text:gsub("%[tool:[^%]]*$", "")
  for length = 1, #"[tool:" - 1 do
    if text:sub(-length) == ("[tool:"):sub(1, length) then
      text = text:sub(1, #text - length)
      break
    end
  end
  local lines = {}
  local code = false
  for raw_line in (text .. "\n"):gmatch("(.-)\n") do
    local line = raw_line
    if line:match("^%s*```") or line:match("^%s*~~~") then
      code = not code
    elseif code then
      lines[#lines + 1] = line
    else
      line = line:gsub("!%[([^%]]*)%]%([^%)]*%)", "%1")
      line = line:gsub("%[([^%]]+)%]%([^%)]*%)", "%1")
      line = line:gsub("^%s*#+%s+", ""):gsub("^%s*>%s?", "")
      line = line:gsub("^%s*[%-%*%+]%s+", "- ")
      line = line:gsub("%*%*(.-)%*%*", "%1"):gsub("__(.-)__", "%1")
      line = line:gsub("%*([^*\n]+)%*", "%1"):gsub("~~(.-)~~", "%1")
      line = line:gsub("`([^`]+)`", "%1")
      local table_separator = line:find("|", 1, true) and line:match("^%s*[|:%-%s]+%s*$")
      if line:match("^%s*|") then
        line = line:gsub("^%s*|%s*", ""):gsub("%s*|%s*$", ""):gsub("%s*|%s*", " / ")
      end
      if not table_separator and not line:match("^%s*[%-%*_][%-%*_%s]+%s*$") then
        lines[#lines + 1] = line
      end
    end
  end
  return table.concat(lines, "\n"):gsub("\n\n\n+", "\n\n"):gsub("^%s+", ""):gsub("%s+$", "")
end

return M
