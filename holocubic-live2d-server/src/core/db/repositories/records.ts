/** 数据库存储的模型；动作资源由模型入口文件解析。 */
export interface Live2dModelRecord {
  /** 模型的唯一标识。 */
  id: string
  /** 模型的展示名称。 */
  name: string
  /** 模型入口文件（.model3.json）的资源地址。 */
  url: string
  /** 记录创建时间。 */
  createdAt: Date
  /** 记录最后更新时间。 */
  updatedAt: Date
}

/** 动作名称须与资源解析使用的名称一致，不保存 group 和 index。 */
export interface Live2dMotionRecord {
  /** 动作记录的唯一标识。 */
  id: string
  /** 动作所属模型的唯一标识，对应 Live2dModelRecord.id。 */
  modelId: string
  /** 资源解析时使用的动作名称，用于匹配实际动作。 */
  name: string
  /** 动作的语义描述，用于说明动作的含义或适用场景。 */
  description: string
  /** 记录创建时间。 */
  createdAt: Date
  /** 记录最后更新时间。 */
  updatedAt: Date
}
