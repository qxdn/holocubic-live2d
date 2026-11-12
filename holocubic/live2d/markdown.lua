local M = {}

-- Small-screen plain text; keep the original Markdown in conversation history.
function M.to_text(value)
  local text = value:gsub("\r\n", "\n")
  text = text:gsub("<motion>.-</motion>", "")
  -- Text imitating a tool call is not an executable client instruction.
  text = text:gsub("%[tool:[^%]]*%]", "")
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
