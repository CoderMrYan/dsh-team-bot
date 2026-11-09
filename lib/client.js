window.__ModuleLoader__.load({
  id: "dsh-team-bot",
  factory: (require) => {
    const React = require("react")
    const { useCallback, useEffect, useState } = React

    const API = "/dsh-team-bot/api"

    async function getJson(path) {
      const response = await fetch(API + path, { headers: { accept: "application/json" } })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      return body
    }

    async function postJson(path, value) {
      const response = await fetch(API + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      return body
    }

    const styles = {
      page: {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 480,
        padding: "16px 20px",
        boxSizing: "border-box",
        color: "var(--dsw-alias-label-primary)",
        background: "var(--dsw-alias-bg-base)",
      },
      header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "4px 4px 12px",
      },
      title: { fontSize: 15, fontWeight: 600 },
      muted: { color: "var(--dsw-alias-label-tertiary)", fontSize: 12 },
      body: { display: "flex", flex: 1, minHeight: 0, gap: 12 },
      sidebar: {
        width: 220,
        flex: "0 0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        borderRight: "0.5px solid var(--dsw-alias-border-l2)",
        paddingRight: 10,
        overflowY: "auto",
      },
      room: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        textAlign: "left",
        border: "0.5px solid transparent",
        background: "transparent",
        color: "var(--dsw-alias-label-secondary)",
        borderRadius: 8,
        padding: "6px 8px",
        cursor: "pointer",
        fontSize: 13,
      },
      roomActive: {
        background: "var(--dsw-alias-bg-layer-2)",
        borderColor: "var(--dsw-alias-border-l2)",
        color: "var(--dsw-alias-label-primary)",
      },
      main: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0 },
      members: { display: "flex", flexWrap: "wrap", gap: 6, padding: "0 4px 10px" },
      chip: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        color: "var(--dsw-alias-label-secondary)",
        background: "var(--dsw-alias-bg-layer-2)",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 999,
        padding: "2px 8px 2px 4px",
      },
      timeline: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "4px 4px 12px" },
      rowHuman: { display: "flex", justifyContent: "flex-end" },
      rowBot: { display: "flex", justifyContent: "flex-start" },
      bubbleHuman: {
        maxWidth: "78%",
        background: "var(--dsw-alias-state-business-primary)",
        color: "#fff",
        borderRadius: "12px 12px 4px 12px",
        padding: "8px 12px",
      },
      bubbleBot: {
        maxWidth: "82%",
        background: "var(--dsw-alias-bg-layer-2)",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: "12px 12px 12px 4px",
        padding: "8px 12px",
      },
      meta: { fontSize: 11, opacity: 0.72, marginBottom: 4 },
      text: { whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.55 },
      composer: { display: "flex", gap: 8, padding: "8px 4px 0", borderTop: "0.5px solid var(--dsw-alias-border-l2)" },
      input: {
        flex: 1,
        minHeight: 60,
        maxHeight: 160,
        resize: "vertical",
        borderRadius: 8,
        border: "0.5px solid var(--dsw-alias-border-l2)",
        background: "var(--dsw-alias-bg-layer-2)",
        color: "var(--dsw-alias-label-primary)",
        padding: "8px 10px",
        fontSize: 13,
        fontFamily: "inherit",
      },
      button: {
        alignSelf: "flex-end",
        height: 32,
        padding: "0 14px",
        borderRadius: 8,
        border: "0.5px solid var(--dsw-alias-border-l2)",
        background: "var(--dsw-alias-bg-layer-2)",
        color: "var(--dsw-alias-label-primary)",
        cursor: "pointer",
        fontSize: 13,
      },
      primary: {
        background: "var(--dsw-alias-state-business-primary)",
        borderColor: "transparent",
        color: "#fff",
      },
      error: { color: "var(--dsw-alias-state-error-primary)", fontSize: 12, padding: "4px" },
      empty: { color: "var(--dsw-alias-label-tertiary)", fontSize: 13, padding: 24, textAlign: "center" },
      form: { display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 4px", alignItems: "center" },
      textField: {
        height: 28,
        borderRadius: 6,
        border: "0.5px solid var(--dsw-alias-border-l2)",
        background: "var(--dsw-alias-bg-layer-2)",
        color: "var(--dsw-alias-label-primary)",
        padding: "0 8px",
        fontSize: 12,
      },
      check: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--dsw-alias-label-secondary)" },
      memoryPanel: {
        display: "flex",
        flexDirection: "column",
        gap: 6,
        margin: "0 4px 10px",
        padding: "8px 10px",
        maxHeight: 220,
        overflowY: "auto",
        borderRadius: 8,
        border: "0.5px solid var(--dsw-alias-border-l2)",
        background: "var(--dsw-alias-bg-layer-2)",
      },
      memorySummary: {
        whiteSpace: "pre-wrap",
        fontSize: 11,
        color: "var(--dsw-alias-label-secondary)",
      },
      memoryAtom: { display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12 },
      memoryText: { flex: 1, whiteSpace: "pre-wrap" },
      memoryMeta: { fontSize: 10, color: "var(--dsw-alias-label-tertiary)", whiteSpace: "nowrap" },
      smallButton: {
        padding: "1px 6px",
        borderRadius: 6,
        border: "0.5px solid var(--dsw-alias-border-l2)",
        background: "transparent",
        color: "var(--dsw-alias-label-secondary)",
        cursor: "pointer",
        fontSize: 11,
      },
      composePanel: {
        display: "flex",
        flexDirection: "column",
        gap: 8,
        margin: "0 4px 10px",
        padding: "10px 12px",
        borderRadius: 8,
        border: "0.5px solid var(--dsw-alias-border-l2)",
        background: "var(--dsw-alias-bg-layer-2)",
      },
      composeRow: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
      templateChip: {
        padding: "3px 9px",
        borderRadius: 999,
        border: "0.5px solid var(--dsw-alias-border-l2)",
        background: "transparent",
        color: "var(--dsw-alias-label-secondary)",
        cursor: "pointer",
        fontSize: 11,
      },
    }

    const POLICY_LABEL = { mention: "仅 @ 点名", admin: "总管挑人", auto: "自动挑人" }

    function policyLabel(policy) {
      return `${POLICY_LABEL[policy?.replyMode] ?? policy?.replyMode ?? "mention"} · 每轮最多 ${policy?.maxSpeakers ?? 3} 个 Bot`
    }

    function TeamBotIcon({ size = 18 }) {
      return React.createElement(
        "svg",
        {
          width: size,
          height: size,
          viewBox: "0 0 24 24",
          fill: "none",
          "aria-hidden": true,
          style: { display: "block" },
        },
        React.createElement("path", {
          d: "M4 6.2A2.2 2.2 0 0 1 6.2 4h7.1A2.2 2.2 0 0 1 15.5 6.2v3.1a2.2 2.2 0 0 1-2.2 2.2H9.6L6.8 13.6v-2.1h-.6A2.2 2.2 0 0 1 4 9.3V6.2Z",
          fill: "currentColor",
        }),
        React.createElement("path", {
          d: "M10.4 13.1a2.2 2.2 0 0 1 2.2-2.2h5.2a2.2 2.2 0 0 1 2.2 2.2v2.7a2.2 2.2 0 0 1-2.2 2.2h-.5v2.2l-2.9-2.2h-1.8a2.2 2.2 0 0 1-2.2-2.2v-2.7Z",
          fill: "currentColor",
          opacity: 0.72,
        }),
      )
    }

    function Avatar({ avatar, name, size = 26 }) {
      const hue = avatar?.hue ?? 210
      const variant = avatar?.variant ?? 0
      const ReactUseId = React.useId
      const rawId = ReactUseId === undefined ? `av-${hue}-${variant}` : ReactUseId()
      const uid = `av${String(rawId).replace(/[^a-zA-Z0-9_-]/g, "")}`
      const light = `hsl(${hue} 78% 62%)`
      const dark = `hsl(${(hue + 38) % 360} 72% 40%)`
      const initial = String(name ?? "?").trim().slice(0, 1)
      return React.createElement(
        "svg",
        {
          width: size,
          height: size,
          viewBox: "0 0 40 40",
          "aria-hidden": true,
          style: { flex: "0 0 auto", borderRadius: "50%", display: "block" },
        },
        React.createElement("defs", null,
          React.createElement("linearGradient", { id: uid, x1: "0", y1: "0", x2: "1", y2: "1" },
            React.createElement("stop", { offset: "0%", stopColor: light }),
            React.createElement("stop", { offset: "100%", stopColor: dark }),
          ),
        ),
        React.createElement("circle", { cx: 20, cy: 20, r: 20, fill: `url(#${uid})` }),
        variant === 3
          ? React.createElement("text", {
              x: 20,
              y: 26,
              textAnchor: "middle",
              fontSize: 17,
              fontWeight: 700,
              fill: "#fff",
              fontFamily: "system-ui, sans-serif",
            }, initial)
          : React.createElement(React.Fragment, null,
              React.createElement("circle", { cx: 14.2, cy: 17, r: 2.4, fill: "#fff", opacity: 0.92 }),
              React.createElement("circle", { cx: 25.8, cy: 17, r: 2.4, fill: "#fff", opacity: 0.92 }),
              React.createElement("path", {
                d: "M14 25c1.8 2 3.8 3 6 3s4.2-1 6-3",
                stroke: "#fff",
                strokeWidth: 2,
                strokeLinecap: "round",
                fill: "none",
                opacity: 0.9,
              }),
            ),
        variant === 0
          ? React.createElement("circle", { cx: 20, cy: 20, r: 18.4, fill: "none", stroke: "#fff", strokeOpacity: 0.28, strokeWidth: 1 })
          : null,
        variant === 2
          ? React.createElement("path", { d: "M6 30 L30 8", stroke: "#fff", strokeOpacity: 0.18, strokeWidth: 5, strokeLinecap: "round" })
          : null,
      )
    }

    function TeamBotPage() {
      const [state, setState] = useState({ bots: [], rooms: [] })
      const [roomId, setRoomId] = useState("")
      const [messages, setMessages] = useState([])
      const [text, setText] = useState("")
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState("")
      const [showCreate, setShowCreate] = useState(false)
      const [newRoom, setNewRoom] = useState("")
      const [members, setMembers] = useState([])
      const [showMemory, setShowMemory] = useState(false)
      const [memory, setMemory] = useState(undefined)
      const [fact, setFact] = useState("")
      const [showCompose, setShowCompose] = useState(false)
      const [composeBrief, setComposeBrief] = useState("")
      const [templates, setTemplates] = useState([])

      const refreshState = useCallback(async () => {
        const data = await getJson("/state")
        setState({ bots: data.bots || [], rooms: data.rooms || [] })
        setRoomId((current) => current || data.rooms?.[0]?.id || "")
      }, [])

      useEffect(() => {
        refreshState().catch((failure) => setError(failure.message))
      }, [refreshState])

      useEffect(() => {
        getJson("/templates")
          .then((data) => setTemplates(data.templates || []))
          .catch(() => undefined)
      }, [])

      const loadMessages = useCallback(async (id) => {
        if (!id) {
          setMessages([])
          return
        }
        const data = await getJson(`/rooms/${encodeURIComponent(id)}/messages?limit=100`)
        setMessages(data.messages || [])
      }, [])

      const refreshMemory = useCallback(async (id) => {
        if (!id) {
          setMemory(undefined)
          return
        }
        const data = await getJson(`/rooms/${encodeURIComponent(id)}/memory`)
        setMemory(data.room)
      }, [])

      useEffect(() => {
        let alive = true
        const tick = async () => {
          try {
            await loadMessages(roomId)
          } catch (failure) {
            if (alive) setError(failure.message)
          }
        }
        tick()
        const timer = setInterval(tick, 3000)
        return () => {
          alive = false
          clearInterval(timer)
        }
      }, [roomId, loadMessages])

      useEffect(() => {
        if (!showMemory || roomId === "") return
        refreshMemory(roomId).catch((failure) => setError(failure.message))
      }, [showMemory, roomId, refreshMemory])

      const send = async () => {
        const value = text.trim()
        if (value === "" || roomId === "" || busy) return
        setBusy(true)
        setError("")
        setText("")
        try {
          await postJson(`/rooms/${encodeURIComponent(roomId)}/ask`, { text: value })
          await loadMessages(roomId)
          if (showMemory) await refreshMemory(roomId)
        } catch (failure) {
          setError(failure.message)
          setText(value)
        } finally {
          setBusy(false)
        }
      }

      const createRoom = async () => {
        if (newRoom.trim() === "" || busy) return
        setBusy(true)
        setError("")
        try {
          const room = await postJson("/rooms", { name: newRoom.trim(), members, reply_mode: "auto" })
          setNewRoom("")
          setMembers([])
          setShowCreate(false)
          await refreshState()
          setRoomId(room.id)
        } catch (failure) {
          setError(failure.message)
        } finally {
          setBusy(false)
        }
      }

      const runCompose = async (templateId) => {
        const chosen = templateId === undefined ? undefined : templates.find((item) => item.id === templateId)
        const brief = composeBrief.trim() || chosen?.name || ""
        if (brief === "" || busy) return
        setBusy(true)
        setError("")
        try {
          const result = await postJson("/compose", {
            brief,
            ...(templateId === undefined ? {} : { template: templateId }),
          })
          setComposeBrief("")
          setShowCompose(false)
          setShowCreate(false)
          await refreshState()
          setRoomId(result.rooms?.[0]?.id ?? "")
        } catch (failure) {
          setError(failure.message)
        } finally {
          setBusy(false)
        }
      }

      const addFact = async () => {
        const value = fact.trim()
        if (value === "" || roomId === "" || busy) return
        setBusy(true)
        setError("")
        try {
          await postJson(`/rooms/${encodeURIComponent(roomId)}/memory`, { text: value })
          setFact("")
          await refreshMemory(roomId)
        } catch (failure) {
          setError(failure.message)
        } finally {
          setBusy(false)
        }
      }

      const reviewAtom = async (atomId, action) => {
        try {
          await postJson(`/rooms/${encodeURIComponent(roomId)}/memory/review`, { atom_id: atomId, action })
          await refreshMemory(roomId)
        } catch (failure) {
          setError(failure.message)
        }
      }

      const deleteAtom = async (atomId) => {
        try {
          const response = await fetch(`${API}/rooms/${encodeURIComponent(roomId)}/memory?atom=${encodeURIComponent(atomId)}`, {
            method: "DELETE",
          })
          const body = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
          await refreshMemory(roomId)
        } catch (failure) {
          setError(failure.message)
        }
      }

      const room = state.rooms.find((item) => item.id === roomId)
      const roomBots = room === undefined
        ? []
        : room.members.map((id) => state.bots.find((bot) => bot.id === id)).filter(Boolean)

      return React.createElement(
        "div",
        { style: styles.page },
        React.createElement(
          "div",
          { style: styles.header },
          React.createElement("div", null,
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
              room === undefined ? null : React.createElement(Avatar, { avatar: room.avatar, name: room.name, size: 22 }),
              React.createElement("div", { style: styles.title }, "团队群组"),
            ),
            React.createElement("div", { style: styles.muted },
              room === undefined ? "还没有房间" : policyLabel(room.policy)),
          ),
          React.createElement("div", { style: { display: "flex", gap: 6 } },
            React.createElement("button", {
              type: "button",
              style: styles.button,
              onClick: () => setShowMemory((value) => !value),
            }, showMemory ? "收起记忆" : "记忆"),
            React.createElement("button", {
              type: "button",
              style: styles.button,
              onClick: () => setShowCompose((value) => !value),
            }, showCompose ? "收起建队" : "AI 建队"),
            React.createElement("button", {
              type: "button",
              style: { ...styles.button, ...styles.primary },
              onClick: () => setShowCreate((value) => !value),
            }, showCreate ? "收起" : "新建房间"),
          ),
        ),
        error === "" ? null : React.createElement("div", { style: styles.error }, error),
        showCompose
          ? React.createElement("div", { style: styles.composePanel },
              React.createElement("div", { style: { fontSize: 12, fontWeight: 600 } }, "一句话建团队"),
              React.createElement("div", { style: styles.muted }, "描述目标，或直接点一个模板：会自动建好 Bot、主群和分组。"),
              React.createElement("div", { style: styles.composeRow },
                React.createElement("input", {
                  style: { ...styles.textField, flex: 1, minWidth: 220 },
                  placeholder: "例如：我要做一个短视频团队 / 开发一个 App",
                  value: composeBrief,
                  onChange: (event) => setComposeBrief(event.target.value),
                }),
                React.createElement("button", {
                  type: "button",
                  style: { ...styles.button, ...styles.primary, height: 28 },
                  disabled: busy || (composeBrief.trim() === "" && templates.length === 0),
                  onClick: () => runCompose(),
                }, "生成团队"),
              ),
              React.createElement("div", { style: styles.composeRow },
                templates.map((template) => React.createElement("button", {
                  key: template.id,
                  type: "button",
                  style: styles.templateChip,
                  onClick: () => runCompose(template.id),
                }, template.name)),
              ),
            )
          : null,
        showCreate
          ? React.createElement(
              "div",
              { style: styles.form },
              React.createElement("input", {
                style: styles.textField,
                placeholder: "房间名",
                value: newRoom,
                onChange: (event) => setNewRoom(event.target.value),
              }),
              state.bots.map((bot) => React.createElement("label", { key: bot.id, style: styles.check },
                React.createElement("input", {
                  type: "checkbox",
                  checked: members.includes(bot.id),
                  onChange: (event) => setMembers((current) => event.target.checked
                    ? [...current, bot.id]
                    : current.filter((id) => id !== bot.id)),
                }),
                bot.name,
              )),
              React.createElement("button", {
                type: "button",
                style: { ...styles.button, ...styles.primary },
                disabled: busy,
                onClick: createRoom,
              }, "创建"),
            )
          : null,
        React.createElement(
          "div",
          { style: styles.body },
          React.createElement(
            "aside",
            { style: styles.sidebar },
            state.rooms.length === 0
              ? React.createElement("div", { style: styles.muted }, "点右上角新建房间")
              : state.rooms.map((item) => React.createElement("button", {
                  key: item.id,
                  type: "button",
                  style: item.id === roomId ? { ...styles.room, ...styles.roomActive } : styles.room,
                  onClick: () => setRoomId(item.id),
                },
                React.createElement(Avatar, { avatar: item.avatar, name: item.name, size: 24 }),
                React.createElement("span", {
                  style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                }, item.name),
                )),
          ),
          React.createElement(
            "main",
            { style: styles.main },
            room === undefined
              ? React.createElement("div", { style: styles.empty }, "建一个房间，把 Bot 拉进来")
              : React.createElement(
                  React.Fragment,
                  null,
                  React.createElement("div", { style: styles.members },
                    roomBots.map((bot) => React.createElement("span", { key: bot.id, style: styles.chip },
                      React.createElement(Avatar, { avatar: bot.avatar, name: bot.name, size: 16 }),
                      React.createElement("span", null, bot.name),
                    )),
                    busy ? React.createElement("span", { style: styles.chip }, "Bot 正在回复…") : null,
                  ),
                  showMemory
                    ? React.createElement("div", { style: styles.memoryPanel },
                        memory === undefined
                          ? React.createElement("div", { style: styles.muted }, "加载记忆…")
                          : React.createElement(React.Fragment, null,
                              memory.summary === "" ? null : React.createElement("div", { style: styles.memorySummary }, memory.summary),
                              memory.atoms.length === 0
                                ? React.createElement("div", { style: styles.muted }, "还没有共享记忆")
                                : memory.atoms.map((atom) => React.createElement("div", { key: atom.id, style: styles.memoryAtom },
                                    React.createElement("span", { style: styles.memoryText }, atom.text),
                                    React.createElement("span", { style: styles.memoryMeta },
                                      atom.review === "pending" ? "待审" : atom.review === "rejected" ? "已拒" : "已记"),
                                    atom.review === "pending"
                                      ? React.createElement("button", { type: "button", style: styles.smallButton, onClick: () => reviewAtom(atom.id, "accept") }, "收")
                                      : null,
                                    atom.review === "pending"
                                      ? React.createElement("button", { type: "button", style: styles.smallButton, onClick: () => reviewAtom(atom.id, "reject") }, "拒")
                                      : null,
                                    React.createElement("button", { type: "button", style: styles.smallButton, onClick: () => deleteAtom(atom.id) }, "×"),
                                  )),
                              React.createElement("div", { style: { display: "flex", gap: 6 } },
                                React.createElement("input", {
                                  style: { ...styles.textField, flex: 1 },
                                  placeholder: "记住一条共享事实…",
                                  value: fact,
                                  onChange: (event) => setFact(event.target.value),
                                }),
                                React.createElement("button", { type: "button", style: styles.smallButton, onClick: addFact }, "记住"),
                              ),
                            ),
                      )
                    : null,
                  React.createElement("div", { style: styles.timeline },
                    messages.map((message) => React.createElement("div", {
                      key: message.id,
                      style: message.sender.type === "human" ? styles.rowHuman : styles.rowBot,
                    }, React.createElement("div", {
                      style: message.sender.type === "human" ? styles.bubbleHuman : styles.bubbleBot,
                    },
                    React.createElement("div", { style: styles.meta }, message.sender.type === "human" ? "你" : message.sender.name),
                    React.createElement("div", { style: styles.text }, message.text),
                    ))),
                  ),
                  React.createElement("div", { style: styles.composer },
                    React.createElement("textarea", {
                      style: styles.input,
                      placeholder: "说点什么，@ 某个 Bot 或直接发（按房间策略路由）",
                      value: text,
                      onChange: (event) => setText(event.target.value),
                      onKeyDown: (event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) send()
                      },
                    }),
                    React.createElement("button", {
                      type: "button",
                      style: { ...styles.button, ...styles.primary },
                      disabled: busy || text.trim() === "",
                      onClick: send,
                    }, busy ? "发送中" : "发送"),
                  ),
                ),
          ),
        ),
      )
    }

    function apply(ctx) {
      ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
        name: "sidebar.panellist",
        id: "team-bot",
        order: 20,
        label: "团队群组",
      }, TeamBotIcon))
      ctx.slots.inject("main", () => ctx.slots.register({
        name: "main",
        key: "team-bot",
      }, TeamBotPage))
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "team-bot",
        order: 40,
        label: "团队群组",
      }, TeamBotPage))
    }

    return { apply, inject: ["slots"] }
  },
})
