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
        overflowX: "hidden",
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
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
      muted: { color: "var(--dsw-alias-label-tertiary)", fontSize: 12 },
      pill: {
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 6px",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 999,
        fontSize: 9,
        fontWeight: 700,
        lineHeight: 1.4,
      },
      body: { display: "flex", flex: 1, minHeight: 0, minWidth: 0, gap: 12 },
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
        width: "100%",
        boxSizing: "border-box",
        margin: "0 0 4px",
        borderRadius: 6,
        border: "0.5px solid var(--dsw-alias-border-l2)",
        background: "var(--dsw-alias-bg-layer-2)",
        color: "var(--dsw-alias-label-primary)",
        padding: "0 8px",
        fontSize: 12,
        fontFamily: "inherit",
      },
      main: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden" },
      members: { display: "flex", flexWrap: "wrap", gap: 6, padding: "0 4px 10px" },
      chip: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        maxWidth: "100%",
        overflow: "hidden",
        fontSize: 11,
        color: "var(--dsw-alias-label-secondary)",
        background: "var(--dsw-alias-bg-layer-2)",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 999,
        padding: "2px 8px 2px 4px",
      },
      timeline: { flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 10, padding: "4px 4px 12px" },
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
      text: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word", fontSize: 13, lineHeight: 1.55 },
      composer: { position: "relative", display: "flex", flexWrap: "wrap", gap: 8, width: "100%", flexShrink: 0, boxSizing: "border-box", padding: "8px 4px 0", borderTop: "0.5px solid var(--dsw-alias-border-l2)" },
      input: {
        flex: 1,
        minWidth: 0,
        width: "100%",
        boxSizing: "border-box",
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
      error: { color: "var(--dsw-alias-state-error-primary)", fontSize: 12, padding: "4px", overflowWrap: "anywhere" },
      empty: { color: "var(--dsw-alias-label-tertiary)", fontSize: 13, padding: 24, textAlign: "center" },
      form: { display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 4px", alignItems: "center" },
      textField: {
        height: 28,
        minWidth: 0,
        boxSizing: "border-box",
        maxWidth: "100%",
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
      memoryAtom: { display: "flex", alignItems: "flex-start", gap: 6, minWidth: 0, fontSize: 12 },
      memoryText: { flex: 1, minWidth: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
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
      sheetBackdrop: {
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(0, 0, 0, 0.35)",
      },
      sheet: {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 80,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxSizing: "border-box",
        maxHeight: "78vh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        margin: 0,
        padding: "14px 16px calc(16px + env(safe-area-inset-bottom))",
        borderRadius: "16px 16px 0 0",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        background: "var(--dsw-alias-bg-layer-2)",
        boxShadow: "0 -12px 40px rgba(0, 0, 0, 0.35)",
      },
      sheetHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      },
      mentionPopup: {
        flexBasis: "100%",
        width: "100%",
        order: -1,
        maxHeight: 180,
        overflowY: "auto",
        marginBottom: 6,
        padding: 4,
        borderRadius: 10,
        border: "0.5px solid var(--dsw-alias-border-l2)",
        background: "var(--dsw-alias-bg-layer-2)",
        boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.25)",
      },
      mentionItem: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "6px 8px",
        border: "none",
        borderRadius: 6,
        background: "transparent",
        color: "var(--dsw-alias-label-primary)",
        cursor: "pointer",
        textAlign: "left",
        fontSize: 13,
        outline: "none",
      },
      mentionRole: {
        flex: "0 1 auto",
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontSize: 11,
        color: "var(--dsw-alias-label-tertiary)",
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

    function activeMention(value) {
      const at = String(value ?? "").lastIndexOf("@")
      if (at < 0) return undefined
      const tail = String(value).slice(at + 1)
      if (/\s/.test(tail)) return undefined
      return tail
    }

    function blurActiveElement() {
      if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }

    function TeamBotPage() {
      const [state, setState] = useState({ bots: [], rooms: [], tasks: [], presence: [], activity: [], approvals: [], main: undefined })
      const [view, setView] = useState("main")
      const [mainMessages, setMainMessages] = useState([])
      const [mainText, setMainText] = useState("")
      const [mainBusy, setMainBusy] = useState(false)
      const [selectedTaskId, setSelectedTaskId] = useState("")
      const [selectedBotId, setSelectedBotId] = useState("")
      const [rightTab, setRightTab] = useState("bots")
      const [botEditing, setBotEditing] = useState(false)
      const [botDraft, setBotDraft] = useState({ name: "", role: "", persona: "", workspace: "" })
      const [botAnchor, setBotAnchor] = useState(null)
      const [botConfirmDelete, setBotConfirmDelete] = useState(false)
      const [drawerError, setDrawerError] = useState("")
      const [roomId, setRoomId] = useState("")
      const [messages, setMessages] = useState([])
      const [text, setText] = useState("")
      const [mentions, setMentions] = useState([])
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
        setState({
          bots: data.bots || [],
          rooms: data.rooms || [],
          tasks: data.tasks || [],
          presence: data.presence || [],
          activity: data.activity || [],
          approvals: data.approvals || [],
          main: data.main,
        })
        setRoomId((current) => (data.rooms || []).some((room) => room.id === current)
          ? current
          : (data.rooms?.[0]?.id || ""))
      }, [])

      useEffect(() => {
        refreshState().catch((failure) => setError(failure.message))
        const timer = setInterval(() => {
          refreshState().catch(() => undefined)
        }, 4000)
        return () => clearInterval(timer)
      }, [refreshState])

      const loadMainMessages = useCallback(async (id) => {
        if (!id) {
          setMainMessages([])
          return
        }
        const data = await getJson(`/dms/${encodeURIComponent(id)}/messages?limit=100`)
        setMainMessages(data.messages || [])
      }, [])

      useEffect(() => {
        const id = state.main?.id
        if (!id) return
        let alive = true
        const tick = () => {
          loadMainMessages(id).catch((failure) => {
            if (alive) setError(failure.message)
          })
        }
        tick()
        const timer = setInterval(tick, 2500)
        return () => {
          alive = false
          clearInterval(timer)
        }
      }, [state.main?.id, loadMainMessages])

      useEffect(() => {
        const bot = state.bots.find((item) => item.id === selectedBotId)
        if (bot === undefined) return
        setBotDraft({
          name: bot.name,
          role: bot.role,
          persona: bot.persona ?? "",
          workspace: bot.workspace ?? "",
        })
        setBotEditing(false)
        setBotConfirmDelete(false)
        setDrawerError("")
      }, [selectedBotId])

      const sendMain = async () => {
        const value = mainText.trim()
        if (value === "" || mainBusy) return
        setMainBusy(true)
        setError("")
        setMainText("")
        try {
          await postJson("/main/ask", { text: value })
          await refreshState()
          if (state.main?.id) await loadMainMessages(state.main.id)
        } catch (failure) {
          setError(failure.message)
          setMainText(value)
        } finally {
          setMainBusy(false)
        }
      }

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
        setMessages([])
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

      useEffect(() => {
        const element = timelineRef.current
        if (element !== null) element.scrollTop = element.scrollHeight
      }, [mainMessages.length, view])

      useEffect(() => {
        setMentions([])
      }, [roomId])

      const send = async () => {
        const value = text.trim()
        if (value === "" || roomId === "" || busy) return
        setBusy(true)
        setError("")
        setText("")
        try {
          const inferred = roomBots
            .filter((bot) => value.includes(`@${bot.name}`))
            .map((bot) => bot.id)
          const mentionIds = [...new Set([...mentions, ...inferred])]
          await postJson(`/rooms/${encodeURIComponent(roomId)}/ask`, { text: value, mentions: mentionIds })
          setMentions([])
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

      const mention = activeMention(text)
      const mentionCandidates = mention === undefined || room === undefined
        ? []
        : roomBots
            .filter((bot) => bot.name.toLowerCase().includes(mention.toLowerCase()))
            .slice(0, 8)
      const chooseMention = (bot) => {
        const at = text.lastIndexOf("@")
        if (at < 0) return
        setText(`${text.slice(0, at)}@${bot.name} `)
        setMentions((current) => [...new Set([...current, bot.id])])
      }

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

      const pageStyle = isMobile
        ? {
            ...styles.page,
            minHeight: "100%",
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: "calc(12px + env(safe-area-inset-left))",
            paddingRight: "calc(12px + env(safe-area-inset-right))",
          }
        : styles.page
      const headerStyle = isMobile ? { ...styles.header, flexWrap: "wrap", gap: 8, padding: "0 0 8px" } : styles.header
      const bodyStyle = isMobile
        ? { ...styles.body, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" }
        : styles.body
      const sidebarStyle = isMobile
        ? {
            ...styles.sidebar,
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            zIndex: 40,
            width: "74%",
            maxWidth: 280,
            padding: "10px 12px",
            background: "var(--dsw-alias-bg-base)",
            boxShadow: "0 0 32px rgba(0, 0, 0, 0.35)",
            display: showRooms ? "flex" : "none",
          }
        : styles.sidebar
      const mainStyle = isMobile
        ? { ...styles.main, width: "100%", flex: 1, minHeight: 0 }
        : styles.main
      const buttonStyle = isMobile ? { ...styles.button, height: 28, padding: "0 9px", fontSize: 12 } : styles.button
      const inputStyle = isMobile ? { ...styles.input, minHeight: 48, fontSize: 16, resize: "none" } : styles.input
      const textFieldStyle = isMobile ? { ...styles.textField, height: 36, fontSize: 16 } : styles.textField
      const searchStyle = isMobile ? { ...styles.search, height: 36, fontSize: 16 } : styles.search
      const composerStyle = isMobile
        ? { ...styles.composer, paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }
        : styles.composer
      const composePanelStyle = isMobile ? styles.sheet : styles.composePanel
      const managePanelStyle = isMobile ? styles.sheet : styles.composePanel
      const memoryPanelStyle = isMobile ? styles.sheet : styles.memoryPanel
      const createFormStyle = isMobile ? { ...styles.sheet, alignItems: "stretch" } : styles.form
      const sheetOpen = isMobile && (showCompose || (showManage && room !== undefined) || showMemory || showCreate)

      const openManage = () => {
        if (room === undefined) return
        blurActiveElement()
        setManageMembers(room.members)
        setManageChief(room.chiefId)
        setTeamNameDraft(room.teamName || room.name)
        setShowCompose(false)
        setShowCreate(false)
        setShowMemory(false)
        setShowManage(true)
      }

      const closeSheets = () => {
        setShowCompose(false)
        setShowManage(false)
        setShowMemory(false)
        setShowCreate(false)
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

      const consoleCardStyle = {
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 10,
        background: "var(--dsw-alias-bg-layer-1)",
        padding: 10,
        boxSizing: "border-box",
      }
      const main = state.main
      const presenceFor = (botId) => state.presence.find((row) => row.botId === botId) ?? {
        botId,
        status: "idle",
        action: "",
        taskId: "",
      }
      const presenceLabel = {
        idle: "空闲",
        thinking: "思考中",
        tool: "调用工具",
        waiting: "等待验收",
        blocked: "阻塞",
        offline: "离线",
      }
      const presenceColor = {
        idle: "var(--dsw-alias-label-tertiary)",
        thinking: "#5aa2ff",
        tool: "#4adeb2",
        waiting: "#f4b860",
        blocked: "var(--dsw-alias-state-error-primary)",
        offline: "var(--dsw-alias-label-tertiary)",
      }
      const taskStatusLabel = {
        queued: "排队",
        running: "执行中",
        waiting: "待验收",
        blocked: "阻塞",
        done: "完成",
        failed: "失败",
      }
      const taskStatusColor = {
        queued: "var(--dsw-alias-label-tertiary)",
        running: "#5aa2ff",
        waiting: "#f4b860",
        blocked: "var(--dsw-alias-state-error-primary)",
        done: "#4adeb2",
        failed: "var(--dsw-alias-state-error-primary)",
      }
      const selectedTask = state.tasks.find((task) => task.id === selectedTaskId)
      const selectedBot = state.bots.find((bot) => bot.id === selectedBotId)
      const visibleActivity = selectedBotId === ""
        ? state.activity
        : state.activity.filter((item) => item.botId === selectedBotId)
      const timeLabel = (ts) => {
        if (!ts) return ""
        try { return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) } catch { return "" }
      }
      const sendMainCommand = async (value) => {        const command = String(value ?? "").trim()
        if (command === "" || mainBusy) return
        setMainBusy(true)
        setError("")
        setMainText("")
        try {
          await postJson("/main/ask", { text: command })
          await refreshState()
          if (main?.id) await loadMainMessages(main.id)
        } catch (failure) {
          setError(failure.message)
          setMainText(command)
        } finally {
          setMainBusy(false)
        }
      }

      const openBot = (bot, event) => {
        blurActiveElement()
        const rect = event?.currentTarget?.getBoundingClientRect?.()
        if (rect !== undefined && rect !== null && typeof window !== "undefined") {
          const top = Math.max(12, Math.min(window.innerHeight - 420, rect.top - 24))
          const right = Math.max(12, window.innerWidth - rect.left + 10)
          setBotAnchor({ top, right })
        } else {
          setBotAnchor(null)
        }
        setSelectedBotId(bot.id)
        setRightTab("bots")
        setBotConfirmDelete(false)
        setDrawerError("")
      }

      const closeBot = () => {
        setSelectedBotId("")
        setBotAnchor(null)
        setBotConfirmDelete(false)
        setDrawerError("")
      }

      const saveBot = async () => {
        if (selectedBot === undefined || botDraft.name.trim() === "") return
        setMainBusy(true)
        setDrawerError("")
        try {
          const response = await fetch(`${API}/bots/${encodeURIComponent(selectedBot.id)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(botDraft),
          })
          const body = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
          setBotEditing(false)
          await refreshState()
        } catch (failure) {
          setDrawerError(failure.message)
        } finally {
          setMainBusy(false)
        }
      }

      const deleteSelectedBot = async () => {
        if (selectedBot === undefined || selectedBot.isMain === true) return
        const roomsWithBot = state.rooms.filter((room) => (room.members ?? []).includes(selectedBot.id))
        if (roomsWithBot.length > 0) {
          setDrawerError(`这个 Bot 还在房间：${roomsWithBot.map((room) => room.name).join("、")}。请先在房间管理里移除它，再删除。`)
          return
        }
        if (!botConfirmDelete) {
          setBotConfirmDelete(true)
          setDrawerError("")
          return
        }
        setMainBusy(true)
        setDrawerError("")
        try {
          const response = await fetch(`${API}/bots/${encodeURIComponent(selectedBot.id)}`, { method: "DELETE" })
          const body = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
          closeBot()
          await refreshState()
        } catch (failure) {
          setDrawerError(failure.message)
        } finally {
          setMainBusy(false)
        }
      }

      const cancelMain = async () => {
        setMainBusy(true)
        setError("")
        try {
          await postJson("/main/cancel", {})
          await refreshState()
        } catch (failure) {
          setError(failure.message)
        } finally {
          setMainBusy(false)
        }
      }

      const resolveApproval = async (id, action) => {
        if (mainBusy) return
        setMainBusy(true)
        setError("")
        try {
          await postJson(`/approvals/${encodeURIComponent(id)}/${action}`, {})
          await refreshState()
        } catch (failure) {
          setError(failure.message)
        } finally {
          setMainBusy(false)
        }
      }

      const renderMainConsole = () => React.createElement(
        "div",
        { style: { ...pageStyle, display: "flex", flexDirection: "column", overflowY: "auto" } },
        React.createElement("div", { style: headerStyle },
          React.createElement("div", { style: { minWidth: 0, flex: isMobile ? "1 1 100%" : "1 1 auto" } },
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
              main === undefined ? null : React.createElement(Avatar, { avatar: main.avatar, name: main.name, size: 22 }),
              React.createElement("div", { style: styles.title }, "指挥台 · 主 Bot"),
              React.createElement("span", { style: { ...styles.pill, color: "#5aa2ff", borderColor: "#5aa2ff" } }, "MAIN"),
            ),
            React.createElement("div", { style: styles.muted },
              main === undefined
                ? "主 Bot 初始化中"
                : `${state.bots.length} 个 Bot · ${state.tasks.length} 个任务 · ${state.presence.filter((row) => ["thinking", "tool"].includes(row.status)).length} 个正在执行`),
          ),
          React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, flex: "0 0 auto" } },
            React.createElement("button", {
              type: "button",
              style: { ...buttonStyle, ...styles.primary },
              onClick: () => {
                blurActiveElement()
                setView("rooms")
                if (isMobile) setShowRooms(true)
              },
            }, "房间"),
            React.createElement("button", {
              type: "button",
              style: buttonStyle,
              onClick: () => refreshState().catch((failure) => setError(failure.message)),
            }, "刷新"),
            main !== undefined && ["thinking", "tool", "waiting"].includes(presenceFor(main.id).status)
              ? React.createElement("button", {
                  type: "button",
                  style: { ...styles.smallButton, color: "var(--dsw-alias-state-error-primary)", borderColor: "var(--dsw-alias-state-error-primary)" },
                  disabled: mainBusy,
                  onClick: cancelMain,
                }, mainBusy ? "停止中" : "停止")
              : null,
          ),
        ),
        error === "" ? null : React.createElement("div", { style: styles.error }, error),
        React.createElement("div", {
          style: {
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: 10,
            flex: 1,
            minHeight: 0,
            alignItems: "stretch",
          },
        },
          React.createElement("div", { style: { flex: "1 1 58%", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 } },
            React.createElement("div", { style: { ...consoleCardStyle, height: isMobile ? 360 : 430, display: "flex", flexDirection: "column", minHeight: 0 } },
              React.createElement("div", { style: styles.sheetHeader },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 600 } }, "和主 Bot 说人话"),
                React.createElement("span", { style: styles.muted }, mainBusy ? "调度中…" : "可直接下命令"),
              ),
              React.createElement("div", {
                ref: timelineRef,
                style: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "4px 0" },
              },
                mainMessages.length === 0
                  ? React.createElement("div", { style: styles.muted }, "例如：建一个短视频团队；给 researcher 派一个查资料的任务；现在每个 Bot 在干嘛？")
                  : mainMessages.slice(-30).map((message) => React.createElement("div", {
                      key: message.id,
                      style: {
                        alignSelf: message.sender.type === "bot" ? "flex-start" : "flex-end",
                        maxWidth: "92%",
                        padding: "8px 10px",
                        borderRadius: 10,
                        background: message.sender.type === "bot" ? "var(--dsw-alias-bg-layer-2)" : "var(--dsw-alias-state-business-primary)",
                        color: message.sender.type === "bot" ? "var(--dsw-alias-label-primary)" : "#fff",
                        fontSize: 12,
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.55,
                      },
                    }, message.text)),
              ),
              React.createElement("div", { style: { ...styles.composer, padding: "8px 0 0", borderTop: "0.5px solid var(--dsw-alias-border-l2)" } },
                React.createElement("input", {
                  style: { ...textFieldStyle, flex: 1, minWidth: 0 },
                  placeholder: "例如：建一个研究团队，拉三个人，然后给他们派今天的任务",
                  value: mainText,
                  onChange: (event) => setMainText(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      sendMainCommand(mainText)
                    }
                  },
                }),
                React.createElement("button", {
                  type: "button",
                  style: { ...styles.button, ...styles.primary, height: 32 },
                  disabled: mainBusy || mainText.trim() === "",
                  onClick: () => sendMainCommand(mainText),
                }, mainBusy ? "调度中" : "下发"),
              ),
              React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 8 } },
                ["建一个短视频团队", "现在每个 Bot 在干嘛？", "给 researcher 派一个查资料的任务"].map((prompt) => React.createElement("button", {
                  key: prompt,
                  type: "button",
                  style: styles.templateChip,
                  onClick: () => sendMainCommand(prompt),
                }, prompt)),
              ),
            ),
            React.createElement("div", { style: { ...consoleCardStyle, padding: 12 } },
              React.createElement("div", { style: styles.sheetHeader },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 600 } }, "任务"),
                React.createElement("span", { style: styles.muted }, "点击任务看执行步骤"),
              ),
              state.tasks.length === 0
                ? React.createElement("div", { style: styles.muted }, "还没有任务。让主 Bot 派一个，或直接新建。")
                : state.tasks.slice(0, 8).map((task) => {
                    const owner = state.bots.find((bot) => bot.id === task.ownerBotId)
                    return React.createElement("div", {
                      key: task.id,
                      onClick: () => setSelectedTaskId(task.id === selectedTaskId ? "" : task.id),
                      style: {
                        padding: "8px 10px",
                        marginTop: 6,
                        borderRadius: 8,
                        border: `0.5px solid ${task.id === selectedTaskId ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-border-l2)"}`,
                        background: task.id === selectedTaskId ? "var(--dsw-alias-bg-layer-2)" : "transparent",
                        cursor: "pointer",
                      },
                    },
                      React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
                        React.createElement("span", { style: { color: taskStatusColor[task.status] ?? "inherit", fontSize: 10, fontWeight: 700 } }, taskStatusLabel[task.status] ?? task.status),
                        React.createElement("span", { style: { fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, task.title),
                        React.createElement("span", { style: { ...styles.muted, fontSize: 10 } }, owner?.name ?? "未分配"),
                      ),
                      React.createElement("div", { style: { ...styles.muted, fontSize: 10, marginTop: 3 } }, task.currentStep || "等待执行"),
                      React.createElement("div", { style: { height: 3, borderRadius: 3, background: "var(--dsw-alias-border-l2)", marginTop: 5, overflow: "hidden" } },
                        React.createElement("div", { style: { height: "100%", width: `${task.progress ?? 0}%`, background: taskStatusColor[task.status] ?? "#5aa2ff" } }),
                      ),
                    )
                  }),
              selectedTask === undefined ? null : React.createElement("div", { style: { marginTop: 10, borderTop: "0.5px solid var(--dsw-alias-border-l2)", paddingTop: 8 } },
                React.createElement("div", { style: { fontSize: 11, fontWeight: 600, marginBottom: 6 } }, `执行步骤 · ${selectedTask.title}`),
                React.createElement("div", { style: { maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 } },
                  (selectedTask.steps ?? []).slice(-30).map((step) => React.createElement("div", { key: step.id, style: { fontSize: 10, display: "flex", gap: 6 } },
                    React.createElement("span", { style: { color: step.status === "error" ? "var(--dsw-alias-state-error-primary)" : "var(--dsw-alias-label-tertiary)", minWidth: 38 } }, timeLabel(step.ts)),
                    React.createElement("span", { style: { fontWeight: 600, minWidth: 70 } }, step.label),
                    React.createElement("span", { style: { ...styles.muted, flex: 1, minWidth: 0, wordBreak: "break-word" } }, step.detail),
                  )),
                ),
              ),
            ),
          ),
          React.createElement("div", { style: { flex: "1 1 34%", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 } },
            state.approvals.length === 0 ? null : React.createElement("div", { style: { ...consoleCardStyle, padding: 12, borderColor: "#f4b860" } },
              React.createElement("div", { style: styles.sheetHeader },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "#f4b860" } }, `待审批 · ${state.approvals.length}`),
                React.createElement("span", { style: styles.muted }, "破坏性操作"),
              ),
              state.approvals.map((approval) => React.createElement("div", {
                key: approval.id,
                style: { padding: "8px 0", borderBottom: "0.5px solid var(--dsw-alias-border-l2)" },
              },
                React.createElement("div", { style: { fontSize: 11, fontWeight: 600, lineHeight: 1.45 } }, approval.summary),
                React.createElement("div", { style: { ...styles.muted, fontSize: 9, marginTop: 3 } }, `${approval.kind} · ${approval.id}`),
                React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 6 } },
                  React.createElement("button", {
                    type: "button",
                    style: { ...styles.smallButton, ...styles.smallButtonActive },
                    disabled: mainBusy,
                    onClick: () => resolveApproval(approval.id, "approve"),
                  }, "批准并执行"),
                  React.createElement("button", {
                    type: "button",
                    style: styles.smallButton,
                    disabled: mainBusy,
                    onClick: () => resolveApproval(approval.id, "reject"),
                  }, "拒绝"),
                ),
              )),
            ),
            React.createElement("div", { style: { display: "flex", gap: 6 } },
              React.createElement("button", {
                type: "button",
                style: { ...styles.smallButton, ...(rightTab === "bots" ? styles.smallButtonActive : {}) },
                onClick: () => setRightTab("bots"),
              }, "Bot 状态"),
              React.createElement("button", {
                type: "button",
                style: { ...styles.smallButton, ...(rightTab === "activity" ? styles.smallButtonActive : {}) },
                onClick: () => setRightTab("activity"),
              }, "活动流"),
            ),
            rightTab === "bots"
              ? React.createElement("div", { style: { ...consoleCardStyle, padding: 12, minHeight: 300, maxHeight: isMobile ? "46vh" : "calc(100vh - 300px)", overflowY: "auto" } },
                  React.createElement("div", { style: styles.sheetHeader },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 600 } }, "Bot 状态"),
                    React.createElement("span", { style: styles.muted }, "点名字编辑"),
                  ),
                  state.bots.map((bot) => {
                    const row = presenceFor(bot.id)
                    return React.createElement("div", {
                      key: bot.id,
                      onClick: (event) => openBot(bot, event),
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "6px 4px",
                        borderBottom: "0.5px solid var(--dsw-alias-border-l2)",
                        cursor: "pointer",
                        borderRadius: 6,
                        background: bot.id === selectedBotId ? "var(--dsw-alias-bg-layer-2)" : "transparent",
                      },
                    },
                      React.createElement(Avatar, { avatar: bot.avatar, name: bot.name, size: 18 }),
                      React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                        React.createElement("div", { style: { fontSize: 11, fontWeight: 600 } }, `${bot.name}${bot.isMain ? " ★" : ""}`),
                        React.createElement("div", { style: { ...styles.muted, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, row.action || bot.role),
                      ),
                      React.createElement("span", { style: { fontSize: 9, color: presenceColor[row.status] ?? "inherit", whiteSpace: "nowrap" } }, presenceLabel[row.status] ?? row.status),
                    )
                  }),
                )
              : React.createElement("div", { style: { ...consoleCardStyle, padding: 12, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } },
                  React.createElement("div", { style: styles.sheetHeader },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 600 } }, selectedBot === undefined ? "活动流" : `活动流 · ${selectedBot.name}`),
                    selectedBot === undefined
                      ? React.createElement("span", { style: styles.muted }, "工具 / 汇报 / 交接")
                      : React.createElement("button", { type: "button", style: styles.smallButton, onClick: () => setSelectedBotId("") }, "全部"),
                  ),
                  React.createElement("div", { style: { flex: 1, maxHeight: isMobile ? 300 : 440, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 } },
                    visibleActivity.length === 0
                      ? React.createElement("div", { style: styles.muted }, "还没有活动。")
                      : visibleActivity.slice(-40).reverse().map((item) => {
                          const actor = state.bots.find((bot) => bot.id === item.botId)
                          return React.createElement("div", { key: item.id, style: { fontSize: 10, lineHeight: 1.45, borderLeft: "2px solid var(--dsw-alias-border-l2)", paddingLeft: 7 } },
                            React.createElement("div", { style: { fontWeight: 600 } }, `${actor?.name ?? item.botId} · ${item.label}`),
                            item.detail === "" ? null : React.createElement("div", { style: styles.muted }, item.detail),
                            React.createElement("div", { style: { ...styles.muted, fontSize: 9 } }, timeLabel(item.ts)),
                          )
                        }),
                  ),
                ),
          ),
          selectedBot === undefined ? null : React.createElement(React.Fragment, null,
            React.createElement("div", {
              style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.42)", zIndex: 70 },
              onClick: closeBot,
            }),
            React.createElement("div", {
              onClick: (event) => event.stopPropagation(),
              style: {
                position: "fixed",
                zIndex: 71,
                background: "var(--dsw-alias-bg-layer-1)",
                border: "0.5px solid var(--dsw-alias-border-l2)",
                borderRadius: isMobile ? "14px 14px 0 0" : 12,
                padding: 16,
                boxSizing: "border-box",
                overflowY: "auto",
                ...(isMobile
                  ? { left: 0, right: 0, bottom: 0, maxHeight: "82vh" }
                  : {
                      top: botAnchor?.top ?? 24,
                      right: botAnchor?.right ?? 24,
                      width: 390,
                      maxHeight: `calc(100vh - ${(botAnchor?.top ?? 24) + 24}px)`,
                    }),
              },
            },
              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 9 } },
                React.createElement(Avatar, { avatar: selectedBot.avatar, name: selectedBot.name, size: 28 }),
                React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                  React.createElement("div", { style: { fontSize: 14, fontWeight: 700 } }, `${selectedBot.name}${selectedBot.isMain ? " ★" : ""}`),
                  React.createElement("div", { style: { ...styles.muted, fontSize: 11 } }, `${selectedBot.role || "无角色"} · ${presenceLabel[presenceFor(selectedBot.id).status] ?? "空闲"}`),
                ),
                React.createElement("button", { type: "button", style: styles.smallButton, onClick: closeBot }, "关闭"),
              ),
              React.createElement("div", { style: { ...styles.muted, fontSize: 10, marginTop: 8 } },
                `id: ${selectedBot.id}`,
                selectedBot.workspace ? ` · workspace: ${selectedBot.workspace}` : " · 默认团队 workspace",
              ),
              drawerError === "" ? null : React.createElement("div", { style: { ...styles.error, marginTop: 8, border: "0.5px solid var(--dsw-alias-state-error-primary)", borderRadius: 6, padding: 8 } }, drawerError),
              React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 10 } },
                React.createElement("button", {
                  type: "button",
                  style: styles.smallButton,
                  onClick: () => setBotEditing((value) => !value),
                }, botEditing ? "取消编辑" : "编辑名称/角色"),
                selectedBot.isMain ? null : React.createElement("button", {
                  type: "button",
                  style: {
                    ...styles.smallButton,
                    color: botConfirmDelete ? "#fff" : "var(--dsw-alias-state-error-primary)",
                    borderColor: "var(--dsw-alias-state-error-primary)",
                    background: botConfirmDelete ? "var(--dsw-alias-state-error-primary)" : "transparent",
                  },
                  disabled: mainBusy,
                  onClick: deleteSelectedBot,
                }, botConfirmDelete ? "确认删除" : "删除 Bot"),
                botConfirmDelete ? React.createElement("button", {
                  type: "button",
                  style: styles.smallButton,
                  onClick: () => setBotConfirmDelete(false),
                }, "取消") : null,
              ),
              botEditing
                ? React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 7, marginTop: 10 } },
                    React.createElement("input", {
                      style: textFieldStyle,
                      placeholder: "名称",
                      value: botDraft.name,
                      onChange: (event) => setBotDraft((current) => ({ ...current, name: event.target.value })),
                    }),
                    React.createElement("input", {
                      style: textFieldStyle,
                      placeholder: "角色，例如 researcher / 审校",
                      value: botDraft.role,
                      onChange: (event) => setBotDraft((current) => ({ ...current, role: event.target.value })),
                    }),
                    React.createElement("input", {
                      style: textFieldStyle,
                      placeholder: "persona / 长期工作说明",
                      value: botDraft.persona,
                      onChange: (event) => setBotDraft((current) => ({ ...current, persona: event.target.value })),
                    }),
                    React.createElement("input", {
                      style: textFieldStyle,
                      placeholder: "workspace 路径（留空用团队 workspace）",
                      value: botDraft.workspace,
                      onChange: (event) => setBotDraft((current) => ({ ...current, workspace: event.target.value })),
                    }),
                    React.createElement("div", { style: { display: "flex", gap: 6 } },
                      React.createElement("button", {
                        type: "button",
                        style: { ...styles.button, ...styles.primary, height: 28 },
                        disabled: mainBusy || botDraft.name.trim() === "",
                        onClick: saveBot,
                      }, "保存"),
                      React.createElement("button", { type: "button", style: styles.smallButton, onClick: () => setBotEditing(false) }, "取消"),
                    ),
                  )
                : null,
              React.createElement("div", { style: { marginTop: 14, borderTop: "0.5px solid var(--dsw-alias-border-l2)", paddingTop: 10 } },
                React.createElement("div", { style: { fontSize: 11, fontWeight: 600, marginBottom: 5 } }, "当前任务"),
                state.tasks.filter((task) => task.ownerBotId === selectedBot.id).length === 0
                  ? React.createElement("div", { style: styles.muted }, "没有任务")
                  : state.tasks.filter((task) => task.ownerBotId === selectedBot.id).map((task) => React.createElement("div", {
                      key: task.id,
                      style: { fontSize: 11, padding: "4px 0", color: taskStatusColor[task.status] ?? "inherit" },
                    }, `${taskStatusLabel[task.status] ?? task.status} · ${task.title} · ${task.progress ?? 0}%`)),
              ),
              React.createElement("div", { style: { marginTop: 12, borderTop: "0.5px solid var(--dsw-alias-border-l2)", paddingTop: 10 } },
                React.createElement("div", { style: { fontSize: 11, fontWeight: 600, marginBottom: 5 } }, "最近活动"),
                state.activity.filter((item) => item.botId === selectedBot.id).slice(-20).reverse().map((item) => React.createElement("div", {
                  key: item.id,
                  style: { fontSize: 10, lineHeight: 1.45, padding: "3px 0", borderBottom: "0.5px solid var(--dsw-alias-border-l2)" },
                },
                  React.createElement("div", { style: { fontWeight: 600 } }, item.label),
                  item.detail === "" ? null : React.createElement("div", { style: styles.muted }, item.detail),
                  React.createElement("div", { style: { ...styles.muted, fontSize: 9 } }, timeLabel(item.ts)),
                )),
              ),
            ),
          ),
        ),
      )

      if (view === "main") return renderMainConsole()

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
            React.createElement("button", {
              type: "button",
              style: { ...buttonStyle, ...styles.primary },
              onClick: () => {
                blurActiveElement()
                setView("main")
              },
            }, "指挥台"),
            isMobile ? React.createElement("button", {
              type: "button",
              style: buttonStyle,
              onClick: () => {
                blurActiveElement()
                setShowRooms((value) => !value)
              },
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
              onClick: () => {
                blurActiveElement()
                setShowMemory((value) => !value)
                setShowCompose(false)
                setShowManage(false)
                setShowCreate(false)
              },
            }, showMemory ? "收起记忆" : "记忆"),
            React.createElement("button", {
              type: "button",
              style: buttonStyle,
              onClick: () => {
                blurActiveElement()
                setShowCompose((value) => !value)
                setShowMemory(false)
                setShowManage(false)
                setShowCreate(false)
              },
            }, showCompose ? "收起建队" : "AI 建队"),
            React.createElement("button", {
              type: "button",
              style: { ...buttonStyle, ...styles.primary },
              onClick: () => {
                blurActiveElement()
                setShowCreate((value) => !value)
                setShowMemory(false)
                setShowManage(false)
                setShowCompose(false)
              },
            }, showCreate ? "收起" : "新建房间"),
          ),
        ),
        error === "" ? null : React.createElement("div", { style: styles.error }, error),
        sheetOpen
          ? React.createElement("div", { style: styles.sheetBackdrop, onClick: closeSheets })
          : null,
        showCompose
          ? React.createElement("div", { style: composePanelStyle },
              React.createElement("div", { style: styles.sheetHeader },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 600 } }, "一句话建团队"),
                React.createElement("button", { type: "button", style: styles.smallButton, onClick: closeSheets }, "关闭"),
              ),
              React.createElement("div", { style: styles.muted }, "描述目标，或直接点模板；没匹配到模板时会由架构师生成，可能多等几秒。"),
              React.createElement("div", { style: styles.composeRow },
                React.createElement("input", {
                  style: { ...textFieldStyle, flex: 1, minWidth: isMobile ? 0 : 220 },
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
          ? React.createElement("div", { style: managePanelStyle },
              React.createElement("div", { style: styles.sheetHeader },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 600 } }, `房间设置 · ${room.name}`),
                React.createElement("button", { type: "button", style: styles.smallButton, onClick: closeSheets }, "关闭"),
              ),
              React.createElement("div", { style: styles.muted }, "选成员和总管；同一个 Bot 可以同时是多个房间的总管。"),
              room.teamId === ""
                ? null
                : React.createElement("div", { style: styles.composeRow },
                    React.createElement("span", { style: styles.muted }, "团队名"),
                    React.createElement("input", {
                      style: { ...textFieldStyle, flex: 1 },
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
                  style: textFieldStyle,
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
              { style: createFormStyle },
              isMobile
                ? React.createElement("div", { style: styles.sheetHeader },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 600 } }, "新建房间"),
                    React.createElement("button", { type: "button", style: styles.smallButton, onClick: closeSheets }, "关闭"),
                  )
                : null,
              React.createElement("input", {
                style: textFieldStyle,
                placeholder: "房间名",
                value: newRoom,
                onChange: (event) => setNewRoom(event.target.value),
              }),
              React.createElement("input", {
                style: { ...textFieldStyle, flexBasis: "100%" },
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
                    style: searchStyle,
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
                          blurActiveElement()
                          setMessages([])
                          setRoomId(item.id)
                          setShowManage(false)
                          if (isMobile) setShowRooms(false)
                        },
                      },
                      React.createElement(Avatar, { avatar: item.avatar, name: item.name, size: 24 }),
                      React.createElement("span", {
                        style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
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
                    ? React.createElement("div", { style: memoryPanelStyle },
                        React.createElement("div", { style: styles.sheetHeader },
                          React.createElement("div", { style: { fontSize: 12, fontWeight: 600 } }, "记忆"),
                          React.createElement("button", { type: "button", style: styles.smallButton, onClick: closeSheets }, "关闭"),
                        ),
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
                                  style: { ...textFieldStyle, flex: 1 },
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
                    mention !== undefined && mentionCandidates.length > 0
                      ? React.createElement("div", { style: styles.mentionPopup },
                          mentionCandidates.map((bot) => React.createElement("button", {
                            key: bot.id,
                            type: "button",
                            style: styles.mentionItem,
                            onMouseDown: (event) => event.preventDefault(),
                            onClick: () => chooseMention(bot),
                          },
                          React.createElement(Avatar, { avatar: bot.avatar, name: bot.name, size: 20 }),
                          React.createElement("span", {
                            style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                          }, bot.name),
                          React.createElement("span", { style: styles.mentionRole }, bot.role),
                          )),
                        )
                      : null,
                    React.createElement("textarea", {
                      style: inputStyle,
                      placeholder: "输入 @ 选择成员，或直接发（按房间策略路由）",
                      value: text,
                      onChange: (event) => {
                        const value = event.target.value
                        setText(value)
                        setMentions((current) => current.filter((id) => {
                          const bot = state.bots.find((item) => item.id === id)
                          return bot !== undefined && value.includes(`@${bot.name}`)
                        }))
                      },
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

    class TeamBotErrorBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: undefined }
      }

      static getDerivedStateFromError(error) {
        return { error }
      }

      componentDidCatch(error, info) {
        console.error("dsh-team-bot panel crashed", error, info)
      }

      render() {
        if (this.state.error !== undefined) {
          return React.createElement("div", {
            style: {
              padding: 16,
              color: "var(--dsw-alias-state-error-primary)",
              fontSize: 13,
              whiteSpace: "pre-wrap",
            },
          }, `团队群组加载失败：${String(this.state.error?.message ?? this.state.error)}`)
        }
        return this.props.children
      }
    }

    function TeamBotShell() {
      return React.createElement(TeamBotErrorBoundary, null, React.createElement(TeamBotPage))
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
      }, TeamBotShell))
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "team-bot",
        order: 40,
        label: "团队群组",
      }, TeamBotShell))
    }

    return { apply, inject: ["slots"] }
  },
})
