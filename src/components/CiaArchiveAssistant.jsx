import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowClockwise, CaretRight, MoonStars, PaperPlaneTilt, X } from "@phosphor-icons/react";
import { getCiaConversationHistory } from "../ciaGuideConversation";
import { getCiaReplyLocale } from "../ciaGuideLanguage";
import { getGuidedNavigationLoading, getGuidedNavigationReply, getRequestedDestination, navigationDestinations } from "../ciaGuideNavigation";
import "./CiaArchiveAssistant.css";

const apiPath = "/api/cia-guide";
const requestTimeoutMs = 20_000;
const timeoutReplies = {
  zh: "这次等得有点久，还没收到回复。你可以再试一次。",
  en: "I haven't received a reply yet. You can try again.",
  ja: "まだ返事が届いていません。もう一度試してみてください。",
};

const routeContexts = {
  home: "home",
  work: "work",
  detail: "work",
  gameWall: "game-wall",
  music: "music",
  character: "character",
};

const pageDestinationIds = {
  home: "home",
  work: "work",
  detail: "work",
  gameWall: "gameWall",
  music: "music",
  character: "character",
};

function ArchiveMessage({ copy, role, body, variant = "reply" }) {
  const isCia = role === "cia";

  return (
    <article className={`cia-guide__message cia-guide__message--${role} cia-guide__message--${variant}`}>
      <div className="cia-guide__message-byline">
        {isCia && (
          <span className="cia-guide__message-avatar" aria-hidden="true">
            <img src="/characters/cia/avatar-cutout.png" alt="" />
          </span>
        )}
        <span>{isCia ? copy.ciaName : copy.you}</span>
      </div>
      <p>{body}</p>
    </article>
  );
}

export default function CiaArchiveAssistant({ copy, locale, pageKind, blocked = false, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("idle");
  const [navigationLocale, setNavigationLocale] = useState(locale);
  const [notice, setNotice] = useState("");
  const [contextNote, setContextNote] = useState(null);
  const [dismissedContextKeys, setDismissedContextKeys] = useState(() => new Set());
  const inputRef = useRef(null);
  const triggerRef = useRef(null);
  const logRef = useRef(null);
  const requestRef = useRef(null);
  const requestTimeoutRef = useRef(null);
  const navigationTimerRef = useRef(null);
  const navigationSequence = useRef(0);
  const requestSequence = useRef(0);
  const messageSequence = useRef(0);
  const shownContexts = useRef(new Set());
  const contextNoteRef = useRef(null);
  const contextQueueRef = useRef([]);
  const previousLocale = useRef(locale);
  const openRef = useRef(open);
  openRef.current = open;
  const lastContext = useRef(routeContexts[pageKind] ?? "home");
  const panelId = useId();
  const routeContextKey = routeContexts[pageKind];
  const activeDestinationId = pageDestinationIds[pageKind];
  const hasNavigation = Boolean(copy.navigation?.label && copy.navigation?.destinations);
  const availableDestinations = hasNavigation
    ? navigationDestinations.filter((destination) => destination.id !== activeDestinationId)
    : [];
  const routeContextToken = routeContextKey ? `${locale}:${routeContextKey}` : null;
  const routeFallback = !open && !blocked && !contextNote && routeContextKey && !dismissedContextKeys.has(routeContextToken)
    ? { key: routeContextKey, body: copy.contexts?.[routeContextKey] }
    : null;
  const visibleContextNote = contextNote ?? (routeFallback?.body ? routeFallback : null);

  const busy = status !== "idle";
  const showStarters = messages.every((message) => message.variant === "context") && !busy;
  const nextMessageId = () => {
    messageSequence.current += 1;
    return `cia-message-${Date.now()}-${messageSequence.current}`;
  };

  const stopPendingRequest = useCallback(() => {
    requestSequence.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
    if (requestTimeoutRef.current !== null) {
      window.clearTimeout(requestTimeoutRef.current);
      requestTimeoutRef.current = null;
    }
  }, []);

  const stopPendingNavigation = useCallback(() => {
    navigationSequence.current += 1;
    if (navigationTimerRef.current === null) return;
    window.clearTimeout(navigationTimerRef.current);
    navigationTimerRef.current = null;
  }, []);

  const addCiaMessage = useCallback((body, options = {}) => {
    const { contextKey = null, variant = "reply" } = options;
    setMessages((current) => {
      if (contextKey && current.some((message) => message.contextKey === contextKey)) return current;
      return [...current, { id: nextMessageId(), role: "cia", body, contextKey, variant }];
    });
  }, []);

  const acknowledgeContext = useCallback((key) => {
    if (!key) return;
    const token = `${locale}:${key}`;
    setDismissedContextKeys((current) => current.has(token) ? current : new Set([...current, token]));
  }, [locale]);

  const clearContextNotes = useCallback(() => {
    contextNoteRef.current = null;
    contextQueueRef.current = [];
    setContextNote(null);
  }, []);

  const dismissContextNote = useCallback(() => {
    const current = contextNoteRef.current ?? visibleContextNote;
    if (current) acknowledgeContext(current.key);
    const next = contextQueueRef.current.shift() ?? null;
    contextNoteRef.current = next;
    setContextNote(next);
  }, [acknowledgeContext, visibleContextNote]);

  const closePanel = useCallback(() => {
    stopPendingRequest();
    stopPendingNavigation();
    setStatus("idle");
    setNotice("");
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, [stopPendingNavigation, stopPendingRequest]);

  const openPanel = useCallback(() => {
    const note = contextNoteRef.current ?? visibleContextNote;
    if (note) {
      addCiaMessage(note.body, { contextKey: note.key, variant: "context" });
      acknowledgeContext(note.key);
      clearContextNotes();
    }
    setOpen(true);
  }, [acknowledgeContext, addCiaMessage, clearContextNotes, visibleContextNote]);

  useEffect(() => {
    if (!open || blocked) return undefined;
    if (window.matchMedia("(max-width: 720px)").matches) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open, blocked]);

  useEffect(() => {
    if (!blocked) return;
    stopPendingRequest();
    stopPendingNavigation();
    setStatus("idle");
    setNotice("");
    setOpen(false);
    clearContextNotes();
  }, [blocked, clearContextNotes, stopPendingNavigation, stopPendingRequest]);

  useEffect(() => () => {
    stopPendingRequest();
    stopPendingNavigation();
  }, [stopPendingNavigation, stopPendingRequest]);

  useEffect(() => {
    const key = routeContexts[pageKind];
    const localeChanged = previousLocale.current !== locale;
    previousLocale.current = locale;
    if (localeChanged) shownContexts.current.clear();
    clearContextNotes();
    lastContext.current = key ?? "home";
    if (blocked || !key || shownContexts.current.has(key)) return;
    const body = copy.contexts?.[key];
    if (!body) return;
    shownContexts.current.add(key);
    if (openRef.current) {
      addCiaMessage(body, { contextKey: key, variant: "context" });
      return;
    }
    const note = { key, body };
    contextNoteRef.current = note;
    setContextNote(note);
  }, [addCiaMessage, blocked, clearContextNotes, copy.contexts, locale, pageKind]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, status, notice]);

  const announceContext = useCallback((key) => {
    const body = copy.contexts?.[key];
    if (blocked || !body) return;

    // Reading context follows the visible section even if its note was already
    // shown. Notes are once-per-visit; current-page references are not.
    lastContext.current = key;
    if (shownContexts.current.has(key)) return;

    shownContexts.current.add(key);
    if (open) {
      addCiaMessage(body, { contextKey: key, variant: "context" });
      return;
    }
    const note = { key, body };
    if (key !== routeContextKey) acknowledgeContext(routeContextKey);
    if (contextNoteRef.current) {
      contextQueueRef.current.push(note);
      return;
    }
    contextNoteRef.current = note;
    setContextNote(note);
  }, [acknowledgeContext, addCiaMessage, blocked, copy.contexts, open, routeContextKey]);

  useEffect(() => {
    if (blocked || typeof window === "undefined" || !("IntersectionObserver" in window)) return undefined;

    const main = document.getElementById("main-content");
    if (!main) return undefined;

    const watched = new Set();
    let checkFrame = null;
    const targetDepth = (target) => {
      let depth = 0;
      let ancestor = target.parentElement;
      while (ancestor) {
        depth += 1;
        ancestor = ancestor.parentElement;
      }
      return depth;
    };
    const checkVisibleTargets = () => {
      checkFrame = null;
      const upperBand = window.innerHeight * 0.14;
      const lowerBand = window.innerHeight * 0.82;
      const visible = [...watched]
        .filter((target) => {
          const rect = target.getBoundingClientRect();
          return target.isConnected && rect.bottom > upperBand && rect.top < lowerBand;
        })
        .sort((first, second) => targetDepth(second) - targetDepth(first));
      const target = visible[0];
      const key = target?.getAttribute("data-cia-context");
      if (key) announceContext(key);
    };
    const scheduleVisibleCheck = () => {
      if (checkFrame !== null) return;
      checkFrame = window.requestAnimationFrame(checkVisibleTargets);
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) scheduleVisibleCheck();
    }, { threshold: [0], rootMargin: "-14% 0px -18% 0px" });

    const watchNewTargets = () => {
      main.querySelectorAll("[data-cia-context]").forEach((target) => {
        if (watched.has(target)) return;
        watched.add(target);
        observer.observe(target);
      });
    };

    const mutationObserver = new MutationObserver(() => {
      watchNewTargets();
      scheduleVisibleCheck();
    });
    mutationObserver.observe(main, { childList: true, subtree: true });
    const frame = window.requestAnimationFrame(() => {
      watchNewTargets();
      scheduleVisibleCheck();
    });
    window.addEventListener("scroll", scheduleVisibleCheck, { passive: true });
    window.addEventListener("resize", scheduleVisibleCheck);

    return () => {
      window.cancelAnimationFrame(frame);
      if (checkFrame !== null) window.cancelAnimationFrame(checkFrame);
      window.removeEventListener("scroll", scheduleVisibleCheck);
      window.removeEventListener("resize", scheduleVisibleCheck);
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, [announceContext, blocked, pageKind]);

  useEffect(() => {
    const handleContextEvent = (event) => {
      const key = event.detail?.key;
      if (typeof key === "string") announceContext(key);
    };
    window.addEventListener("phrnono:cia-context", handleContextEvent);
    return () => window.removeEventListener("phrnono:cia-context", handleContextEvent);
  }, [announceContext]);

  const startGuidedNavigation = useCallback((destination, visitorMessage = "") => {
    if (!destination || busy || typeof onNavigate !== "function") return;

    stopPendingRequest();
    stopPendingNavigation();
    const replyLocale = getCiaReplyLocale(visitorMessage, locale, messages);
    const navigationId = navigationSequence.current;
    if (visitorMessage) {
      setMessages((current) => [...current, {
        id: nextMessageId(), role: "visitor", body: visitorMessage, variant: "reply",
      }]);
    }
    addCiaMessage(getGuidedNavigationReply(destination, replyLocale), { variant: "guide" });
    setInput("");
    setNotice("");
    setNavigationLocale(replyLocale);
    setStatus("navigating");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    navigationTimerRef.current = window.setTimeout(async () => {
      navigationTimerRef.current = null;
      if (navigationId !== navigationSequence.current) return;
      try {
        await onNavigate(destination.href);
      } catch {
        if (navigationId === navigationSequence.current) setNotice(copy.error);
      } finally {
        // Same-route and anchor navigation need not create a blocking overlay.
        // Unlock here too; otherwise a harmless no-op disables the chat forever.
        if (navigationId === navigationSequence.current) setStatus("idle");
      }
    }, prefersReducedMotion ? 0 : 520);
  }, [addCiaMessage, busy, copy.error, locale, messages, onNavigate, stopPendingNavigation, stopPendingRequest]);

  const sendMessage = async (value) => {
    const message = value.trim();
    if (!message || busy) return;

    const destination = getRequestedDestination(message);
    if (destination) {
      startGuidedNavigation(destination, message);
      return;
    }

    const history = getCiaConversationHistory(messages);
    const replyLocale = getCiaReplyLocale(message, locale, history);
    const controller = new AbortController();
    requestSequence.current += 1;
    const requestId = requestSequence.current;
    requestRef.current = controller;

    setMessages((current) => [...current, { id: nextMessageId(), role: "visitor", body: message, variant: "reply" }]);
    setInput("");
    setNotice("");
    setStatus("loading");
    requestTimeoutRef.current = window.setTimeout(() => {
      if (requestId !== requestSequence.current) return;
      requestSequence.current += 1;
      requestTimeoutRef.current = null;
      requestRef.current = null;
      controller.abort();
      setStatus("idle");
      setNotice(timeoutReplies[replyLocale] ?? copy.error);
    }, requestTimeoutMs);

    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message,
          locale,
          context: lastContext.current,
          history,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (requestId !== requestSequence.current) return;

      if (typeof payload?.reply === "string" && payload.reply.trim()) {
        addCiaMessage(payload.reply.trim());
        if (!response.ok) setNotice("");
      } else {
        setNotice(copy.error);
      }
    } catch (error) {
      if (requestId === requestSequence.current && error?.name !== "AbortError") setNotice(copy.error);
    } finally {
      if (requestId === requestSequence.current) {
        if (requestTimeoutRef.current !== null) {
          window.clearTimeout(requestTimeoutRef.current);
          requestTimeoutRef.current = null;
        }
        requestRef.current = null;
        setStatus("idle");
      }
    }
  };

  const submit = (event) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage(input);
    }
  };

  const clearConversation = () => {
    stopPendingRequest();
    stopPendingNavigation();
    setStatus("idle");
    setInput("");
    setNotice("");
    setMessages([]);
    window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };

  return (
    <aside className={`cia-guide cia-guide--${pageKind}${open ? " cia-guide--open" : ""}${blocked ? " cia-guide--blocked" : ""}`} aria-label={copy.open}>
      {!open && visibleContextNote && (
        <div className="cia-guide__whisper">
          <button type="button" className="cia-guide__whisper-main" onClick={openPanel}>
            <span className="cia-guide__whisper-avatar" aria-hidden="true"><img src="/characters/cia/avatar-cutout.png" alt="" /></span>
            <span>
              <small>{copy.ciaName}</small>
              <strong>{visibleContextNote.body}</strong>
              <em>{copy.contextAction}<CaretRight aria-hidden="true" weight="bold" /></em>
            </span>
          </button>
          <button type="button" className="cia-guide__whisper-dismiss" onClick={dismissContextNote} aria-label={copy.dismissContext}><X aria-hidden="true" weight="bold" /></button>
        </div>
      )}

      {open ? (
        <section className={`cia-guide__panel${hasNavigation ? " cia-guide__panel--has-routes" : ""}`} id={panelId} role="dialog" aria-modal="false" aria-labelledby="cia-guide-title" onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closePanel();
          }
        }}>
          <header className="cia-guide__header">
            <div className="cia-guide__identity">
              <span className="cia-guide__portrait" aria-hidden="true"><img src="/characters/cia/avatar-cutout.png" alt="" /></span>
              <div>
                <span className="cia-guide__eyebrow"><MoonStars aria-hidden="true" weight="fill" />{copy.eyebrow}</span>
                <h2 id="cia-guide-title">{copy.ciaName}<small>CIA LUNELLE</small></h2>
              </div>
            </div>
            <div className="cia-guide__header-actions">
              <span className="cia-guide__presence"><i aria-hidden="true" />{copy.presence}</span>
              <button type="button" className="cia-guide__icon-button" onClick={closePanel} aria-label={copy.close}>
                <X aria-hidden="true" weight="bold" />
              </button>
            </div>
          </header>

          <div className="cia-guide__opening"><strong>{copy.title}</strong></div>

          {hasNavigation && (
            <details className="cia-guide__routes">
              <summary>{copy.navigation.label}<CaretRight aria-hidden="true" /></summary>
              <div>
                {availableDestinations.map((destination) => {
                  const destinationCopy = copy.navigation.destinations[destination.id];
                  return (
                    <a href={destination.href} key={destination.id} aria-disabled={busy || undefined} onClick={(event) => {
                      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || typeof onNavigate !== "function") return;
                      event.preventDefault();
                      if (!busy) startGuidedNavigation(destination);
                    }}>
                      <span>{destinationCopy?.label}</span><CaretRight aria-hidden="true" weight="bold" />
                    </a>
                  );
                })}
              </div>
            </details>
          )}

          <div className="cia-guide__log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions text" aria-label={copy.conversationLabel}>
            <ArchiveMessage copy={copy} role="cia" body={copy.greeting} variant="greeting" />
            {messages.map((message) => <ArchiveMessage key={message.id} copy={copy} role={message.role} body={message.body} variant={message.variant} />)}
            {status === "loading" && <p className="cia-guide__status" role="status"><span aria-hidden="true"><i /><i /><i /></span>{copy.loading}</p>}
            {status === "navigating" && <p className="cia-guide__status" role="status"><span aria-hidden="true"><i /><i /><i /></span>{getGuidedNavigationLoading(navigationLocale)}</p>}
            {notice && <p className="cia-guide__status cia-guide__status--error" role="status">{notice}</p>}
          </div>

          {showStarters && (
            <section className="cia-guide__starters" aria-label={copy.starterLabel}>
              <p>{copy.starterLabel}</p>
              <div>
                {copy.starters.map((starter) => (
                  <button type="button" key={starter.prompt} onClick={() => void sendMessage(starter.prompt)}>
                    <span>{starter.title}</span><CaretRight aria-hidden="true" weight="bold" />
                  </button>
                ))}
              </div>
            </section>
          )}

          <form className="cia-guide__form" onSubmit={submit}>
            <label className="sr-only" htmlFor="cia-guide-input">{copy.placeholder}</label>
            <textarea
              id="cia-guide-input"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={copy.placeholder}
              maxLength={900}
              rows={2}
              disabled={busy}
              aria-describedby="cia-guide-privacy"
            />
            <div className="cia-guide__form-bottom">
              <span id="cia-guide-privacy">{copy.privacy}</span>
              <button type="submit" disabled={busy || !input.trim()}>
                <span>{copy.send}</span>
                <PaperPlaneTilt aria-hidden="true" weight="fill" />
              </button>
            </div>
          </form>

          {messages.length > 0 && (
            <button type="button" className="cia-guide__clear" onClick={clearConversation}>
              <ArrowClockwise aria-hidden="true" weight="bold" /> {copy.clear}
            </button>
          )}
        </section>
      ) : (
        <button ref={triggerRef} type="button" className="cia-guide__trigger" onClick={openPanel} disabled={blocked} aria-expanded="false">
          <span className="cia-guide__trigger-avatar" aria-hidden="true"><img src="/characters/cia/avatar-cutout.png" alt="" /></span>
          <span className="cia-guide__trigger-copy"><small>{copy.ciaName}</small><strong>{copy.open}</strong></span>
          <span className="cia-guide__trigger-mark" aria-hidden="true"><MoonStars weight="fill" /></span>
        </button>
      )}
    </aside>
  );
}
