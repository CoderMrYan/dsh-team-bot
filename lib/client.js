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
        textAlign: "left",
        border: "0.5px solid transparent",
        background: "transparent",
        color: "var(--dsw-alias-label-secondary)",
        borderRadius: 8,
        padding: "8px 10px",
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
        fontSize: 11,
        color: "var(--dsw-alias-label-secondary)",
        background: "var(--dsw-alias-bg-layer-2)",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 999,
        padding: "2px 8px",
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

      const refreshState = useCallback(async () => {
        const data = await getJson("/state")
        setState({ bots: data.bots || [], rooms: data.rooms || [] })
        setRoomId((current) => current || data.rooms?.[0]?.id || "")
      }, [])

      useEffect(() => {
        refreshState().catch((failure) => setError(failure.message))
      }, [refreshState])

      const loadMessages = useCallback(async (id) => {
        if (!id) {
          setMessages([])
          return
        }
        const data = await getJson(`/rooms/${encodeURIComponent(id)}/messages?limit=100`)
        setMessages(data.messages || [])
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

      const send = async () => {
        const value = text.trim()
        if (value === "" || roomId === "" || busy) return
        setBusy(true)
        setError("")
        setText("")
        try {
          await postJson(`/rooms/${encodeURIComponent(roomId)}/ask`, { text: value })
          await loadMessages(roomId)
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
            React.createElement("div", { style: styles.title }, "团队群组"),
            React.createElement("div", { style: styles.muted },
              room === undefined ? "还没有房间" : `${room.policy.replyMode} · 每轮最多 ${room.policy.maxSpeakers} 个 Bot`),
          ),
          React.createElement("button", {
            type: "button",
            style: { ...styles.button, ...styles.primary },
            onClick: () => setShowCreate((value) => !value),
          }, showCreate ? "收起" : "新建房间"),
        ),
        error === "" ? null : React.createElement("div", { style: styles.error }, error),
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
                }, item.name)),
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
                    roomBots.map((bot) => React.createElement("span", { key: bot.id, style: styles.chip }, bot.name)),
                    busy ? React.createElement("span", { style: styles.chip }, "Bot 正在回复…") : null,
                  ),
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
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "team-bot",
        order: 40,
        label: "团队群组",
      }, TeamBotPage))
    }

    return { apply, inject: [] }
  },
})
