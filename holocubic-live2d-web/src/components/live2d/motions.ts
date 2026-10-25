/** Haru 动作表；使用 Map 查询，后续可按模型替换或更新动作配置。 */
export const motions = new Map<
  string,
  { group: string; index: number; desc: string }
>([
  [
    "haru_g_idle",
    {
      group: "Idle",
      index: 0,
      desc: "默认待机动作，用于角色空闲时的自然表现。",
    },
  ],
  [
    "haru_g_m15",
    {
      group: "Idle",
      index: 1,
      desc: "备用待机动作，用于角色空闲时变化姿态。",
    },
  ],
  [
    "haru_g_m26",
    {
      group: "TapBody",
      index: 0,
      desc: "身体触碰反应动作 m26；具体手势待确认。",
    },
  ],
  [
    "haru_g_m06",
    {
      group: "TapBody",
      index: 1,
      desc: "身体触碰反应动作 m06；具体手势待确认。",
    },
  ],
  [
    "haru_g_m20",
    {
      group: "TapBody",
      index: 2,
      desc: "身体触碰反应动作 m20；具体手势待确认。",
    },
  ],
  [
    "haru_g_m09",
    {
      group: "TapBody",
      index: 3,
      desc: "身体触碰反应动作 m09；具体手势待确认。",
    },
  ],
])
