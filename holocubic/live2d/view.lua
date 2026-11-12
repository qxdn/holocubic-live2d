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
  local history, status, animation
  local chat_font = LV_FONT_MONTSERRAT_14
  local text_font
  local rendered = {}
  local rows = {}
  local tail
  local stopped = false
  local scroll_timer = tmr.create()
  local markdown = dofile(directory .. "/markdown.lua")
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
    if stopped then return end
    scroll_timer:stop()
    if tail then lv_obj_del(tail) tail = nil end
    print("[live2d] render messages", #messages)
    -- Keep existing bubbles mounted to avoid clearing the screen on errors.
    local first = 1
    while first <= #messages and rendered[first]
      and rendered[first].role == messages[first].role
      and rendered[first].content == messages[first].content do
      first = first + 1
    end
    for i = #rows, first, -1 do
      lv_obj_del(rows[i])
      rows[i], rendered[i] = nil, nil
    end
    for i = first, #messages do
      local message = messages[i]
      local is_user = message.role == "user"
      local row = lv_obj_create(history)
      rows[i] = row
      rendered[i] = { role = message.role, content = message.content }
      style(row, BG)
      lv_obj_set_style_pad_all(row, 0, MAIN)
      lv_obj_set_size(row, 152, LV_SIZE_CONTENT)
      lv_obj_set_flex_flow(row, LV_FLEX_FLOW_ROW)
      lv_obj_set_flex_align(row, is_user and LV_FLEX_ALIGN_END or LV_FLEX_ALIGN_START,
        LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START)
      local bubble = lv_obj_create(row)
      style(bubble, is_user and 0x285F9C or PANEL)
      lv_obj_set_style_pad_all(bubble, 6, MAIN)
      lv_obj_set_width(bubble, 132)
      lv_obj_set_height(bubble, LV_SIZE_CONTENT)
      local content = is_user and message.content or markdown.to_text(message.content)
      label(bubble, content, 0, 0, 120, LV_SIZE_CONTENT, chat_font, TEXT)
    end
    -- A short end marker also handles a final bubble taller than the viewport.
    tail = lv_obj_create(history)
    style(tail, BG)
    lv_obj_set_style_pad_all(tail, 0, MAIN)
    lv_obj_set_size(tail, 1, 1)
    -- Flex layout is deferred. Scroll after its next pass, without an animation
    -- that could race another response or use the old content height.
    scroll_timer:alarm(80, tmr.ALARM_SINGLE, function()
      if stopped or app.exiting() then return end
      lv_obj_scroll_to_view(tail, 0)
      print("[live2d] chat scrolled to end", #messages, "tail_y", lv_obj_get_y(tail))
    end)
  end

  local function clean()
    if stopped then return end
    stopped = true
    scroll_timer:unregister()
    animation.clean()
    lv_obj_clean(root)
    -- Delete labels before freeing the font they reference.
    if text_font then
      lv_font_free(text_font)
      text_font = nil
    end
  end

  style(root, BG)
  status = label(root, "等待语音", 166, 8, 146, 20, chat_font, MUTED)

  local stage = lv_obj_create(root)
  style(stage, BG)
  lv_obj_set_pos(stage, 8, 32)
  lv_obj_set_size(stage, 144, 198)
  lv_obj_set_style_pad_all(stage, 0, MAIN)
  animation = dofile(directory .. "/frame2d.lua").create(directory, stage)
  animation.play("idle", "startup")

  history = lv_obj_create(root)
  style(history, BG)
  lv_obj_set_pos(history, 160, 32)
  lv_obj_set_size(history, 152, 198)
  lv_obj_set_style_pad_all(history, 0, MAIN)
  lv_obj_set_style_pad_row(history, 8, MAIN)
  lv_obj_set_flex_flow(history, LV_FLEX_FLOW_COLUMN)
  lv_obj_add_flag(history, LV_OBJ_FLAG_SCROLLABLE)
  lv_obj_set_scroll_dir(history, LV_DIR_VER)

  return {
    render = render,
    clean = clean,
    play_action = animation.play,
    get_input = function() return "" end,
    set_input = function() end,
    set_status = function(value) lv_label_set_text(status, value) end,
    set_hint = function() end,
  }
end

return M
