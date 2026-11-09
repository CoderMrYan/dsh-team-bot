/**
 * Built-in team archetypes. These are the deterministic fallback used when the
 * user says "给我组一个短视频团队" without listing roles; `team_compose` can
 * also take an explicit `roles` array for anything outside these templates.
 */

export const TEAM_TEMPLATES = [
  {
    id: 'short-video',
    name: '短视频团队',
    summary: '从选题、分镜到成片、声音和封面包装的竖屏短视频团队。',
    keywords: ['短视频', '视频', '漫剧', '拍摄', '剪辑', '影视', '分镜', '竖屏'],
    chief: '总导演',
    roles: [
      { name: '总导演', role: '总导演', persona: '统筹叙事、镜头和最终成片方向；只对成片质量负责，不替成员写细节。' },
      { name: '制片', role: '制片', persona: '管预算、排期、资源和跨组协调；发现排期风险立刻说。' },
      { name: '编剧', role: '编剧', persona: '写故事结构、脚本和台词；不写拍摄执行细节。' },
      { name: '前期导演', role: '前期导演', persona: '管选题、分镜、场景和拍摄计划；交付可直接执行的镜头表。' },
      { name: '后期导演', role: '后期导演', persona: '管剪辑节奏、调色和成片风格；对最终观感负责。' },
      { name: '剪辑师', role: '剪辑师', persona: '做粗剪和精剪，按分镜和节奏交付时间线。' },
      { name: '声音设计', role: '声音设计', persona: '管配乐、音效和混音；标注版权和音源来源。' },
      { name: '视觉设计', role: '视觉设计', persona: '做封面、字幕和包装；保证竖屏安全区和可读性。' },
    ],
    rooms: [
      { name: '前期组', members: ['编剧', '前期导演', '制片'], chief: '前期导演' },
      { name: '后期组', members: ['后期导演', '剪辑师', '声音设计', '视觉设计'], chief: '后期导演' },
    ],
  },
  {
    id: 'software',
    name: '软件项目团队',
    summary: '从需求、设计、开发到测试交付的软件项目团队。',
    keywords: ['开发', '项目', '产品', '软件', '前端', '后端', '测试', 'app', '系统'],
    chief: '项目经理',
    roles: [
      { name: '项目经理', role: '项目经理', persona: '拆里程碑、管依赖和风险；所有结论落到可验收的交付物。' },
      { name: '产品经理', role: '产品经理', persona: '写需求、验收标准和优先级；不替开发做技术方案。' },
      { name: 'UI/UX 设计', role: 'UI/UX 设计', persona: '做交互和视觉稿，标注状态和边界；交付可实现的设计说明。' },
      { name: '前端工程师', role: '前端工程师', persona: '实现界面和交互，关注可访问性与性能。' },
      { name: '后端工程师', role: '后端工程师', persona: '设计接口、数据和可靠性方案；写清错误码和边界。' },
      { name: '测试工程师', role: '测试工程师', persona: '写测试计划和用例，按验收标准判定通过或打回。' },
    ],
    rooms: [
      { name: '产品组', members: ['产品经理', 'UI/UX 设计', '项目经理'], chief: '产品经理' },
      { name: '开发组', members: ['前端工程师', '后端工程师', '项目经理'], chief: '项目经理' },
      { name: '测试组', members: ['测试工程师', '产品经理', '项目经理'], chief: '测试工程师' },
    ],
  },
  {
    id: 'content',
    name: '内容团队',
    summary: '从选题、撰稿到审校、排版的图文内容团队。',
    keywords: ['内容', '写作', '公众号', '文章', '周报', '选题', '运营', '文案'],
    chief: '主编',
    roles: [
      { name: '主编', role: '主编', persona: '定选题方向和质量标准；对最终发布负责。' },
      { name: '选题策划', role: '选题策划', persona: '找选题、拆角度、列证据清单；不写完整正文。' },
      { name: '撰稿', role: '撰稿', persona: '按提纲写正文，事实必须带来源。' },
      { name: '审校', role: '审校', persona: '查事实、逻辑、错别字和合规风险；逐条给修改意见。' },
      { name: '排版', role: '排版', persona: '做标题、配图、分段和发布格式；保证移动端可读。' },
    ],
    rooms: [
      { name: '策划组', members: ['选题策划', '主编'], chief: '选题策划' },
      { name: '成稿组', members: ['撰稿', '审校', '排版'], chief: '审校' },
    ],
  },
  {
    id: 'research',
    name: '研究团队',
    summary: '做资料检索、交叉验证和结论输出的研究团队。',
    keywords: ['研究', '调研', '情报', '分析', '报告', '论文', '竞品'],
    chief: '负责人',
    roles: [
      { name: '负责人', role: '负责人', persona: '定问题、拆假设、管结论质量；不让未验证的判断进报告。' },
      { name: '情报研究员', role: '情报研究员', persona: '找一手来源，记录链接、时间和可信度。' },
      { name: '分析师', role: '分析师', persona: '做对比、归因和量化分析；区分事实、推断和观点。' },
      { name: '审校', role: '审校', persona: '逐条核对来源和引用，专门找反证。' },
    ],
    rooms: [
      { name: '情报组', members: ['情报研究员', '负责人'], chief: '情报研究员' },
      { name: '分析组', members: ['分析师', '审校', '负责人'], chief: '分析师' },
    ],
  },
]

/** @returns {object|undefined} the template with the most keyword hits. */
export function matchTemplate(brief) {
  const text = String(brief ?? '').toLowerCase()
  if (text.trim() === '') return undefined
  let best
  let bestScore = 0
  for (const template of TEAM_TEMPLATES) {
    const score = template.keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length
    if (score > bestScore) {
      best = template
      bestScore = score
    }
  }
  return best
}

/** @returns {object|undefined} */
export function getTemplate(templateId) {
  return TEAM_TEMPLATES.find((template) => template.id === templateId)
}

/** @returns {object[]} a serializable summary for the panel. */
export function listTemplates() {
  return TEAM_TEMPLATES.map((template) => ({
    id: template.id,
    name: template.name,
    summary: template.summary,
    chief: template.chief,
    roles: template.roles.map((role) => role.name),
    rooms: template.rooms.map((room) => room.name),
  }))
}
