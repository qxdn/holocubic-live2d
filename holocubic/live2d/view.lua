local M = {}

local MAIN = LV_PART_MAIN | LV_STATE_DEFAULT
local BG, PANEL, TEXT, MUTED = 0x111820, 0x202B36, 0xF3F6FA, 0xAAB7C4

local function style(obj, color)
  lv_obj_set_style_bg_color(obj, color, MAIN)
  lv_obj_set_style_bg_opa(obj, 255, MAIN)
  lv_obj_set_style_border_width(obj, 0, MAIN)
  lv_obj_set_style_radius(obj, 6, MAIN)
  lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE)
end

local function label(parent, text, x, y, w, h, font_size, color)
  local obj = lv_label_create(parent)
  lv_label_set_text(obj, text)
  lv_obj_set_pos(obj, x, y)
  lv_obj_set_size(obj, w, h)
  lv_obj_set_style_text_font(obj, font_size, MAIN)
  lv_obj_set_style_text_color(obj, color, MAIN)
  lv_label_set_long_mode(obj, LV_LABEL_LONG_WRAP)
  return obj
end

function M.create(directory)
  local root = lv_scr_act()
  local transcript, history, status
  local chat_font = LV_FONT_MONTSERRAT_14
  local text_font
  local font_path = directory .. "/font/noto_sans_sc_medium_16_2bpp_common4000.bin"
  local font_ok, loaded_font = pcall(lv_font_load, font_path)
  print("[live2d] font load", font_path, font_ok, type(loaded_font), tostring(loaded_font))
  if font_ok and type(loaded_font) == "number" and loaded_font > 0 then
    chat_font = loaded_font
    text_font = loaded_font
    print("[live2d] CJK font loaded")
  else
    print("[live2d] CJK font unavailable", tostring(loaded_font))
  end

  local function render(messages)
    print("[live2d] render messages", #messages)
    local lines = {}
    for i = 1, #messages do
      local message = messages[i]
      local who = message.role == "user" and "USER / 我: " or "AI / 角色: "
      lines[#lines + 1] = who .. message.content
    end
    local content = #lines > 0 and table.concat(lines, "\n\n") or "VOICE / 等待语音输入"
    lv_label_set_text(transcript, content)
    -- Scroll to the content's end; LVGL clamps to the viewport's scroll range.
    lv_obj_scroll_to_y(history, 32767, 1)
  end

  local function clean()
    lv_obj_clean(root)
    -- Delete labels before freeing the font they reference.
    if text_font then
      lv_font_free(text_font)
      text_font = nil
    end
  end

  style(root, BG)
  label(root, "Live2D", 10, 4, 145, 25, LV_FONT_MONTSERRAT_20, TEXT)
  status = label(root, "等待语音", 166, 8, 146, 20, chat_font, MUTED)
  history = lv_obj_create(root)
  style(history, BG)
  lv_obj_set_pos(history, 8, 32)
  lv_obj_set_size(history, 304, 198)
  lv_obj_set_style_pad_all(history, 0, MAIN)
  lv_obj_add_flag(history, LV_OBJ_FLAG_SCROLLABLE)
  lv_obj_set_scroll_dir(history, LV_DIR_VER)
  transcript = lv_label_create(history)
  lv_obj_set_pos(transcript, 0, 0)
  lv_obj_set_width(transcript, 304)
  lv_obj_set_height(transcript, LV_SIZE_CONTENT)
  lv_label_set_long_mode(transcript, LV_LABEL_LONG_WRAP)
  local style_ok, style_error = pcall(lv_obj_set_style_text_font, transcript, chat_font, MAIN)
  print("[live2d] message font style", style_ok, tostring(style_error), tostring(chat_font))
  lv_obj_set_style_text_color(transcript, TEXT, MAIN)

  return {
    render = render,
    clean = clean,
    get_input = function() return "" end,
    set_input = function() end,
    set_status = function(value) lv_label_set_text(status, value) end,
    set_hint = function() end,
  }
end

return M
