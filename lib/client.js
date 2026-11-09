window.__ModuleLoader__.load({
  id: "dsh-team-bot",
  factory: (require) => {
    const React = require("react")
    const { useCallback, useEffect, useRef, useState } = React

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
      title: {
        fontSize: 15,
        fontWeight: 600,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
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
        outline: "none",
      },
      roomActive: {
        background: "var(--dsw-alias-bg-layer-2)",
        borderColor: "var(--dsw-alias-border-l2)",
        color: "var(--dsw-alias-label-primary)",
        boxShadow: "inset 2px 0 0 var(--dsw-alias-state-business-primary)",
      },
      groupHeader: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        padding: "4px 6px",
        border: "none",
        background: "transparent",
        color: "var(--dsw-alias-label-tertiary)",
        cursor: "pointer",
        fontSize: 11,
        textAlign: "left",
        borderRadius: 6,
        outline: "none",
      },
      groupHeaderHover: { background: "var(--dsw-alias-bg-layer-2)" },
      groupCount: {
        minWidth: 16,
        padding: "0 5px",
        borderRadius: 999,
        background: "var(--dsw-alias-bg-layer-2)",
        fontSize: 10,
        textAlign: "center",
        color: "var(--dsw-alias-label-tertiary)",
      },
      groupChevron: { width: 10, textAlign: "center", fontSize: 10 },
      search: {
        height: 28,
        margin: "0 0 4px",
        borderRadius: 6,
        border: "0.5px solid var(--dsw-alias-border-l2)",
        background: "var(--dsw-alias-bg-layer-2)",
        color: "var(--dsw-alias-label-primary)",
        padding: "0 8px",
        fontSize: 12,
        fontFamily: "inherit",
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
      rowBot: { display: "flex", justifyContent: "flex-start", alignItems: "flex-start", gap: 8 },
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
        outline: "none",
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
        outline: "none",
      },
      smallButtonActive: {
        borderColor: "var(--dsw-alias-state-business-primary)",
        color: "var(--dsw-alias-label-primary)",
        background: "var(--dsw-alias-bg-layer-2)",
      },
      composePanel: {
        display: "flex",
        flexDirection: "column",
        gap: 8,
        margin: "0 4px 10px",
        padding: "10px 12px",
        maxHeight: 300,
        overflowY: "auto",
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
        outline: "none",
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
        variant === 4
          ? React.createElement(React.Fragment, null,
              React.createElement("path", { d: "M9 11 L13 4 L17 10 Z", fill: "#fff", opacity: 0.9 }),
              React.createElement("path", { d: "M23 10 L27 4 L31 11 Z", fill: "#fff", opacity: 0.9 }),
            )
          : null,
        variant === 5
          ? React.createElement(React.Fragment, null,
              React.createElement("circle", { cx: 14.2, cy: 17, r: 4.2, fill: "none", stroke: "#fff", strokeWidth: 1.4, opacity: 0.85 }),
              React.createElement("circle", { cx: 25.8, cy: 17, r: 4.2, fill: "none", stroke: "#fff", strokeWidth: 1.4, opacity: 0.85 }),
              React.createElement("path", { d: "M18.4 17 H21.6", stroke: "#fff", strokeWidth: 1.4, opacity: 0.85 }),
            )
          : null,
        variant === 6
          ? React.createElement("circle", { cx: 20, cy: 20, r: 15.2, fill: "none", stroke: "#fff", strokeOpacity: 0.35, strokeWidth: 1.2 })
          : null,
      )
    }

    function useIsMobile() {
      const [mobile, setMobile] = useState(() => typeof window !== "undefined"
        && typeof window.matchMedia === "function"
        && window.matchMedia("(max-width: 720px)").matches)
      useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
        const query = window.matchMedia("(max-width: 720px)")
        const update = () => setMobile(query.matches)
        update()
        query.addEventListener?.("change", update)
        return () => query.removeEventListener?.("change", update)
      }, [])
      return mobile
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
      const [botQuery, setBotQuery] = useState("")
      const [showMemory, setShowMemory] = useState(false)
      const [memory, setMemory] = useState(undefined)
      const [memoryScope, setMemoryScope] = useState("room")
      const [fact, setFact] = useState("")
      const [showCompose, setShowCompose] = useState(false)
      const [composeBrief, setComposeBrief] = useState("")
      const [templates, setTemplates] = useState([])
      const [collapsed, setCollapsed] = useState({})
      const [hoverKey, setHoverKey] = useState("")
      const [query, setQuery] = useState("")
      const [showRooms, setShowRooms] = useState(false)
      const isMobile = useIsMobile()
      const [showManage, setShowManage] = useState(false)
      const [manageMembers, setManageMembers] = useState([])
      const [manageChief, setManageChief] = useState("")
      const [teamNameDraft, setTeamNameDraft] = useState("")
      const timelineRef = useRef(null)
      const activeTeamId = state.rooms.find((item) => item.id === roomId)?.teamId ?? ""

      const refreshState = useCallback(async () => {
        const data = await getJson("/state")
        setState({ bots: data.bots || [], rooms: data.rooms || [] })
        setRoomId((current) => (data.rooms || []).some((room) => room.id === current)
          ? current
          : (data.rooms?.[0]?.id || ""))
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

      const refreshMemory = useCallback(async (id, scope = "room", teamId = "") => {
        if (!id) {
          setMemory(undefined)
          return
        }
        if (scope === "team" && teamId !== "") {
          const data = await getJson(`/teams/${encodeURIComponent(teamId)}/memory`)
          setMemory(data.team)
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
        const scope = memoryScope === "team" && activeTeamId !== "" ? "team" : "room"
        refreshMemory(roomId, scope, activeTeamId).catch((failure) => setError(failure.message))
      }, [showMemory, roomId, memoryScope, activeTeamId, refreshMemory])

      useEffect(() => {
        const element = timelineRef.current
        if (element !== null) element.scrollTop = element.scrollHeight
      }, [messages.length, roomId])

      const send = async () => {
        const value = text.trim()
        if (value === "" || roomId === "" || busy) return
        setBusy(true)
        setError("")
        setText("")
        try {
          await postJson(`/rooms/${encodeURIComponent(roomId)}/ask`, { text: value })
          await loadMessages(roomId)
          if (showMemory) {
            await refreshMemory(roomId, memoryScope === "team" && activeTeamId !== "" ? "team" : "room", activeTeamId)
          }
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
          setBotQuery("")
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
          if (isMobile) setShowRooms(false)
        } catch (failure) {
          setError(failure.message)
        } finally {
          setBusy(false)
        }
      }

      const addFact = async () => {
        const value = fact.trim()
        if (value === "" || roomId === "" || busy) return
        const scope = memoryScope === "team" && activeTeamId !== "" ? "team" : "room"
        const path = scope === "team"
          ? `/teams/${encodeURIComponent(activeTeamId)}/memory`
          : `/rooms/${encodeURIComponent(roomId)}/memory`
        setBusy(true)
        setError("")
        try {
          await postJson(path, { text: value })
          setFact("")
          await refreshMemory(roomId, scope, activeTeamId)
        } catch (failure) {
          setError(failure.message)
        } finally {
          setBusy(false)
        }
      }

      const reviewAtom = async (atomId, action) => {
        const scope = memoryScope === "team" && activeTeamId !== "" ? "team" : "room"
        const path = scope === "team"
          ? `/teams/${encodeURIComponent(activeTeamId)}/memory/review`
          : `/rooms/${encodeURIComponent(roomId)}/memory/review`
        try {
          await postJson(path, { atom_id: atomId, action })
          await refreshMemory(roomId, scope, activeTeamId)
        } catch (failure) {
          setError(failure.message)
        }
      }

      const deleteAtom = async (atomId) => {
        const scope = memoryScope === "team" && activeTeamId !== "" ? "team" : "room"
        const base = scope === "team"
          ? `${API}/teams/${encodeURIComponent(activeTeamId)}/memory`
          : `${API}/rooms/${encodeURIComponent(roomId)}/memory`
        try {
          const response = await fetch(`${base}?atom=${encodeURIComponent(atomId)}`, {
            method: "DELETE",
          })
          const body = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
          await refreshMemory(roomId, scope, activeTeamId)
        } catch (failure) {
          setError(failure.message)
        }
      }

      const room = state.rooms.find((item) => item.id === roomId)
      const roomBots = room === undefined
        ? []
        : room.members.map((id) => state.bots.find((bot) => bot.id === id)).filter(Boolean)

      const groups = []
      for (const item of state.rooms) {
        const key = item.teamId || "__solo"
        let group = groups.find((entry) => entry.key === key)
        if (group === undefined) {
          group = {
            key,
            name: key === "__solo" ? "单间" : (item.teamName || item.name),
            avatar: item.avatar,
            rooms: [],
          }
          groups.push(group)
        }
        group.rooms.push(item)
      }

      const keyword = query.trim().toLowerCase()
      const visibleGroups = groups
        .map((group) => ({
          ...group,
          rooms: group.rooms.filter((item) => keyword === ""
            || group.name.toLowerCase().includes(keyword)
            || item.name.toLowerCase().includes(keyword)),
        }))
        .filter((group) => group.rooms.length > 0)

      const pageStyle = isMobile ? { ...styles.page, minHeight: 0, padding: "10px 12px" } : styles.page
      const headerStyle = isMobile ? { ...styles.header, flexWrap: "wrap", gap: 8, padding: "0 0 8px" } : styles.header
      const bodyStyle = isMobile ? { ...styles.body, display: "block", position: "relative" } : styles.body
      const sidebarStyle = isMobile
        ? {
            ...styles.sidebar,
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            zIndex: 30,
            width: "86%",
            maxWidth: 320,
            padding: "10px 12px",
            background: "var(--dsw-alias-bg-base)",
            boxShadow: "0 0 32px rgba(0, 0, 0, 0.35)",
            display: showRooms ? "flex" : "none",
          }
        : styles.sidebar
      const mainStyle = isMobile ? { ...styles.main, height: "100%" } : styles.main
      const buttonStyle = isMobile ? { ...styles.button, height: 28, padding: "0 9px", fontSize: 12 } : styles.button
      const inputStyle = isMobile ? { ...styles.input, minHeight: 48 } : styles.input
      const composerStyle = isMobile
        ? { ...styles.composer, paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }
        : styles.composer

      const openManage = () => {
        if (room === undefined) return
        setManageMembers(room.members)
        setManageChief(room.chiefId)
        setTeamNameDraft(room.teamName || room.name)
        setShowCompose(false)
        setShowCreate(false)
        setShowManage(true)
      }

      const toggleMember = (botId, checked) => {
        const next = checked
          ? [...new Set([...manageMembers, botId])]
          : manageMembers.filter((id) => id !== botId)
        setManageMembers(next)
        if (!next.includes(manageChief)) setManageChief(next[0] || "")
      }

      const saveManage = async () => {
        if (room === undefined || manageMembers.length === 0 || busy) return
        setBusy(true)
        setError("")
        try {
          const response = await fetch(`${API}/rooms/${encodeURIComponent(room.id)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ members: manageMembers, chief_id: manageChief }),
          })
          const body = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
          await refreshState()
          setShowManage(false)
        } catch (failure) {
          setError(failure.message)
        } finally {
          setBusy(false)
        }
      }

      const saveTeamName = async () => {
        if (room === undefined || room.teamId === "" || teamNameDraft.trim() === "" || busy) return
        setBusy(true)
        setError("")
        try {
          const response = await fetch(`${API}/teams/${encodeURIComponent(room.teamId)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: teamNameDraft.trim() }),
          })
          const body = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
          await refreshState()
        } catch (failure) {
          setError(failure.message)
        } finally {
          setBusy(false)
        }
      }

      const removeRoom = async () => {
        if (room === undefined || busy) return
        if (!window.confirm(`删除房间「${room.name}」？此操作不可撤销。`)) return
        setBusy(true)
        setError("")
        try {
          const response = await fetch(`${API}/rooms/${encodeURIComponent(room.id)}`, { method: "DELETE" })
          const body = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
          setShowManage(false)
          setRoomId("")
          await refreshState()
        } catch (failure) {
          setError(failure.message)
        } finally {
          setBusy(false)
        }
      }

      const removeTeam = async () => {
        if (room === undefined || room.teamId === "" || busy) return
        const label = room.teamName || room.name
        if (!window.confirm(`删除团队「${label}」及其所有房间和 Bot？此操作不可撤销。`)) return
        setBusy(true)
        setError("")
        try {
          const response = await fetch(`${API}/teams/${encodeURIComponent(room.teamId)}`, { method: "DELETE" })
          const body = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
          setShowManage(false)
          setRoomId("")
          await refreshState()
        } catch (failure) {
          setError(failure.message)
        } finally {
          setBusy(false)
        }
      }

      return React.createElement(
        "div",
        { style: pageStyle },
        React.createElement(
          "div",
          { style: headerStyle },
          React.createElement("div", { style: isMobile ? { minWidth: 0, flex: "1 1 100%" } : undefined },
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
              room === undefined ? null : React.createElement(Avatar, { avatar: room.avatar, name: room.name, size: 22 }),
              React.createElement("div", { style: styles.title }, room === undefined ? "团队群组" : room.name),
            ),
            React.createElement("div", { style: styles.muted },
              room === undefined
                ? "还没有房间"
                : `${room.teamName || "单间"} · ${policyLabel(room.policy)}`),
          ),
          React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, ...(isMobile ? { width: "100%" } : {}) } },
            isMobile ? React.createElement("button", {
              type: "button",
              style: buttonStyle,
              onClick: () => setShowRooms((value) => !value),
            }, showRooms ? "收起房间" : "房间") : null,
            room === undefined ? null : React.createElement("button", {
              type: "button",
              style: buttonStyle,
              onClick: () => {
                if (showManage) setShowManage(false)
                else openManage()
              },
            }, showManage ? "收起管理" : "管理"),
            React.createElement("button", {
              type: "button",
              style: buttonStyle,
              onClick: () => setShowMemory((value) => !value),
            }, showMemory ? "收起记忆" : "记忆"),
            React.createElement("button", {
              type: "button",
              style: buttonStyle,
              onClick: () => setShowCompose((value) => !value),
            }, showCompose ? "收起建队" : "AI 建队"),
            React.createElement("button", {
              type: "button",
              style: { ...buttonStyle, ...styles.primary },
              onClick: () => setShowCreate((value) => !value),
            }, showCreate ? "收起" : "新建房间"),
          ),
        ),
        error === "" ? null : React.createElement("div", { style: styles.error }, error),
        showCompose
          ? React.createElement("div", { style: styles.composePanel },
              React.createElement("div", { style: { fontSize: 12, fontWeight: 600 } }, "一句话建团队"),
              React.createElement("div", { style: styles.muted }, "描述目标，或直接点模板；没匹配到模板时会由架构师生成，可能多等几秒。"),
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
        showManage && room !== undefined
          ? React.createElement("div", { style: styles.composePanel },
              React.createElement("div", { style: { fontSize: 12, fontWeight: 600 } }, `房间设置 · ${room.name}`),
              React.createElement("div", { style: styles.muted }, "选成员和总管；同一个 Bot 可以同时是多个房间的总管。"),
              room.teamId === ""
                ? null
                : React.createElement("div", { style: styles.composeRow },
                    React.createElement("span", { style: styles.muted }, "团队名"),
                    React.createElement("input", {
                      style: { ...styles.textField, flex: 1 },
                      value: teamNameDraft,
                      onChange: (event) => setTeamNameDraft(event.target.value),
                    }),
                    React.createElement("button", {
                      type: "button",
                      style: { ...styles.smallButton, ...styles.smallButtonActive },
                      disabled: busy,
                      onClick: saveTeamName,
                    }, "重命名团队"),
                  ),
              React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
                state.bots.map((bot) => React.createElement("label", { key: bot.id, style: styles.check },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: manageMembers.includes(bot.id),
                    onChange: (event) => toggleMember(bot.id, event.target.checked),
                  }),
                  React.createElement(Avatar, { avatar: bot.avatar, name: bot.name, size: 16 }),
                  React.createElement("span", null, bot.name),
                )),
              ),
              React.createElement("div", { style: styles.composeRow },
                React.createElement("span", { style: styles.muted }, "总管"),
                React.createElement("select", {
                  style: styles.textField,
                  value: manageChief,
                  onChange: (event) => setManageChief(event.target.value),
                }, state.bots
                  .filter((bot) => manageMembers.includes(bot.id))
                  .map((bot) => React.createElement("option", { key: bot.id, value: bot.id }, bot.name))),
                React.createElement("button", {
                  type: "button",
                  style: { ...styles.button, ...styles.primary, height: 28 },
                  disabled: busy || manageMembers.length === 0,
                  onClick: saveManage,
                }, "保存成员/总管"),
                React.createElement("button", {
                  type: "button",
                  style: { ...styles.smallButton, color: "var(--dsw-alias-state-error-primary)", borderColor: "var(--dsw-alias-state-error-primary)" },
                  disabled: busy,
                  onClick: removeRoom,
                }, "删除房间"),
                room.teamId === ""
                  ? null
                  : React.createElement("button", {
                      type: "button",
                      style: { ...styles.smallButton, color: "var(--dsw-alias-state-error-primary)", borderColor: "var(--dsw-alias-state-error-primary)" },
                      disabled: busy,
                      onClick: removeTeam,
                    }, "删除团队"),
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
              React.createElement("input", {
                style: { ...styles.textField, flexBasis: "100%" },
                placeholder: "搜索 Bot 名称",
                value: botQuery,
                onChange: (event) => setBotQuery(event.target.value),
              }),
              state.bots
                .filter((bot) => bot.name.toLowerCase().includes(botQuery.trim().toLowerCase()))
                .map((bot) => React.createElement("label", { key: bot.id, style: styles.check },
                React.createElement("input", {
                  type: "checkbox",
                  checked: members.includes(bot.id),
                  onChange: (event) => setMembers((current) => event.target.checked
                    ? [...current, bot.id]
                    : current.filter((id) => id !== bot.id)),
                }),
                React.createElement(Avatar, { avatar: bot.avatar, name: bot.name, size: 16 }),
                React.createElement("span", null, bot.name),
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
          { style: bodyStyle },
          isMobile && showRooms
            ? React.createElement("div", {
                style: {
                  position: "absolute",
                  inset: 0,
                  zIndex: 20,
                  background: "rgba(0, 0, 0, 0.35)",
                },
                onClick: () => setShowRooms(false),
              })
            : null,
          React.createElement(
            "aside",
            { style: sidebarStyle },
            state.rooms.length === 0
              ? React.createElement("div", { style: styles.muted }, "点右上角新建房间")
              : React.createElement(React.Fragment, null,
                  React.createElement("input", {
                    style: styles.search,
                    placeholder: "搜索房间或团队",
                    value: query,
                    onChange: (event) => setQuery(event.target.value),
                  }),
                  visibleGroups.length === 0
                    ? React.createElement("div", { style: styles.muted }, "没有匹配的房间")
                    : visibleGroups.map((group) => React.createElement("div", {
                        key: group.key,
                        style: { display: "flex", flexDirection: "column", gap: 2 },
                      },
                      group.key === "__solo" ? null : React.createElement("button", {
                        type: "button",
                        style: {
                          ...styles.groupHeader,
                          ...(hoverKey === group.key ? styles.groupHeaderHover : {}),
                        },
                        onMouseEnter: () => setHoverKey(group.key),
                        onMouseLeave: () => setHoverKey(""),
                        onClick: () => setCollapsed((current) => ({ ...current, [group.key]: !current[group.key] })),
                      },
                      React.createElement(Avatar, { avatar: group.avatar, name: group.name, size: 16 }),
                      React.createElement("span", {
                        style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                      }, group.name),
                      React.createElement("span", { style: styles.groupCount }, group.rooms.length),
                      React.createElement("span", { style: styles.groupChevron }, collapsed[group.key] ? "▸" : "▾"),
                      ),
                      keyword === "" && collapsed[group.key] ? null : group.rooms.map((item) => React.createElement("button", {
                        key: item.id,
                        type: "button",
                        style: {
                          ...styles.room,
                          paddingLeft: group.key === "__solo" ? 8 : 22,
                          ...(item.id === roomId ? styles.roomActive : {}),
                        },
                        onClick: () => {
                          setRoomId(item.id)
                          setShowManage(false)
                          if (isMobile) setShowRooms(false)
                        },
                      },
                      React.createElement(Avatar, { avatar: item.avatar, name: item.name, size: 24 }),
                      React.createElement("span", {
                        style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                      }, item.name),
                      )),
                    )),
                ),
          ),
          React.createElement(
            "main",
            { style: mainStyle },
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
                        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
                          React.createElement("button", {
                            type: "button",
                            style: { ...styles.smallButton, ...(memoryScope === "room" ? styles.smallButtonActive : {}) },
                            onClick: () => setMemoryScope("room"),
                          }, "房间记忆"),
                          activeTeamId === "" ? null : React.createElement("button", {
                            type: "button",
                            style: { ...styles.smallButton, ...(memoryScope === "team" ? styles.smallButtonActive : {}) },
                            onClick: () => setMemoryScope("team"),
                          }, "团队记忆"),
                          React.createElement("span", { style: styles.memoryMeta },
                            memoryScope === "team" && activeTeamId !== "" ? "全团队共享" : "仅本房间"),
                        ),
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
                  React.createElement("div", { style: styles.timeline, ref: timelineRef },
                    messages.map((message) => {
                      const senderBot = message.sender.type === "bot"
                        ? state.bots.find((bot) => bot.id === message.sender.id)
                        : undefined
                      return React.createElement("div", {
                        key: message.id,
                        style: message.sender.type === "human" ? styles.rowHuman : styles.rowBot,
                      },
                      senderBot === undefined
                        ? null
                        : React.createElement(Avatar, { avatar: senderBot.avatar, name: message.sender.name, size: 22 }),
                      React.createElement("div", {
                        style: message.sender.type === "human" ? styles.bubbleHuman : styles.bubbleBot,
                      },
                      React.createElement("div", { style: styles.meta }, message.sender.type === "human" ? "你" : message.sender.name),
                      React.createElement("div", { style: styles.text }, message.text),
                      ),
                      )
                    }),
                  ),
                  React.createElement("div", { style: composerStyle },
                    React.createElement("textarea", {
                      style: inputStyle,
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
