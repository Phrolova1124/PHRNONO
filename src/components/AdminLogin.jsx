import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import ShapeGrid from "./ShapeGrid";
import "./AdminLogin.css";

const defaultCopy = {
  eyebrow: "管理入口 / ADMIN ACCESS",
  title: "控制室登录",
  description: "使用拥有者账号进入内容管理区。",
  emailLabel: "电子邮箱",
  emailPlaceholder: "you@example.com",
  passwordLabel: "密码",
  passwordPlaceholder: "输入密码",
  submit: "进入控制台",
  submitting: "验证访问权限",
  unavailable: "登录服务尚未连接。",
  errorFallback: "无法完成登录，请检查账号和密码后重试。",
  securityNote: "受保护入口 · 仅限网站拥有者",
  statusReady: "ACCESS GATE / READY",
  statusLoading: "ACCESS GATE / VERIFYING",
};

function normalizeBuildStep(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 4;
  return Math.min(4, Math.max(0, Math.trunc(numericValue)));
}

/**
 * A presentation-first login form for the private PHRNONO control room.
 *
 * `onSubmit` receives `{ email, password }` and may return a promise. It is
 * intentionally not wired to a route or auth provider so the backend can be
 * connected without coupling this component to a particular service. Pass a
 * `buildStep` from 0 through 4 to construct the login UI in phases; the
 * default of 4 renders the complete, immediately usable form.
 */
export default function AdminLogin({
  onSubmit,
  isSubmitting = false,
  error = "",
  initialEmail = "",
  copy: copyOverrides,
  buildStep = 4,
  backgroundMotionEnabled = true,
}) {
  const copy = { ...defaultCopy, ...copyOverrides };
  const reduceMotion = useReducedMotion();
  const currentBuildStep = normalizeBuildStep(buildStep);
  const isBooting = !reduceMotion && currentBuildStep < 4;
  const emailId = useId();
  const passwordId = useId();
  const descriptionId = useId();
  const feedbackId = useId();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");
  const submitting = Boolean(isSubmitting || localSubmitting);
  const feedback = error || localError;

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting || currentBuildStep < 4) return;

    setLocalError("");
    if (typeof onSubmit !== "function") {
      setLocalError(copy.unavailable);
      return;
    }

    try {
      setLocalSubmitting(true);
      await onSubmit({ email: email.trim(), password });
    } catch (submitError) {
      setLocalError(submitError instanceof Error && submitError.message ? submitError.message : copy.errorFallback);
    } finally {
      setLocalSubmitting(false);
    }
  }

  const geometricTransition = reduceMotion
    ? { duration: 0.01 }
    : { duration: 0.9, ease: [0.16, 1, 0.3, 1] };
  const buildTransition = reduceMotion
    ? { duration: 0.01 }
    : { duration: 0.65, ease: [0.16, 1, 0.3, 1] };
  const stagedEntry = (offset = 12) => ({
    initial: reduceMotion ? false : { opacity: 0, y: offset },
    animate: { opacity: 1, y: 0 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 },
    transition: buildTransition,
  });
  const showShell = currentBuildStep >= 1;
  const showBrief = currentBuildStep >= 1;
  const showHeading = currentBuildStep >= 2;
  const showCredentials = currentBuildStep >= 3;
  const showActions = currentBuildStep >= 4;
  const titleId = `${emailId}-title`;

  return (
    <section
      className="admin-login"
      data-build-step={currentBuildStep}
      aria-labelledby={showHeading ? titleId : undefined}
      aria-label={showHeading ? undefined : copy.title}
    >
      <ShapeGrid
        className="admin-login__shape-grid"
        speed={reduceMotion || !backgroundMotionEnabled ? 0 : 0.28}
        squareSize={48}
        direction="diagonal"
        borderColor="rgba(17, 19, 16, 0.08)"
        hoverFillColor="rgba(214, 244, 56, 0)"
        shape="square"
        hoverTrailAmount={0}
      />
      <div className="admin-login__grid" aria-hidden="true" />
      <motion.span
        className="admin-login__scan"
        aria-hidden="true"
        initial={isBooting ? { scaleX: 0 } : false}
        animate={{ scaleX: 1 }}
        transition={{ ...geometricTransition, delay: isBooting && !reduceMotion ? 0.08 : 0, duration: reduceMotion ? 0.01 : 0.76 }}
      />
      <div className="admin-login__edge-label admin-login__edge-label--top" aria-hidden="true">
        PHRNONO / OWNER SPACE
      </div>
      <div className="admin-login__edge-label admin-login__edge-label--bottom" aria-hidden="true">
        REV. 01 · SECURE SESSION
      </div>

      <main className="admin-login__layout">
        <AnimatePresence initial={false} mode="wait">
          {showBrief ? (
            <motion.aside key="brief" className="admin-login__brief" aria-label="登录说明" {...stagedEntry(14)}>
              <p className="admin-login__eyebrow">{copy.eyebrow}</p>
              <div className="admin-login__brief-mark" aria-hidden="true">
                <span>01</span>
                <i />
              </div>
              <p className="admin-login__brief-copy">作品、音乐与访客摘要的私有管理入口。</p>
              <div className="admin-login__brief-status" aria-hidden="true">
                <span />
                <small>OWNER ONLY</small>
              </div>
            </motion.aside>
          ) : (
            <div className="admin-login__brief-spacer" aria-hidden="true" />
          )}
        </AnimatePresence>

        <div className="admin-login__access-stage">
          <div className="admin-login__registration" aria-hidden="true">
            {[0, 1, 2].map((frame) => (
              <motion.span
                key={frame}
                className={`admin-login__frame admin-login__frame--${frame + 1}`}
                initial={false}
                animate={showShell ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.72, rotate: reduceMotion ? 0 : (frame - 1) * 12 }}
                transition={{ ...geometricTransition, delay: showShell && !reduceMotion ? frame * 0.2 : 0 }}
              />
            ))}
            <motion.span
              className="admin-login__axis admin-login__axis--horizontal"
              initial={false}
              animate={showShell ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
              transition={{ ...geometricTransition, delay: showShell && !reduceMotion ? 0.42 : 0, duration: reduceMotion ? 0.01 : 0.8 }}
            />
            <motion.span
              className="admin-login__axis admin-login__axis--vertical"
              initial={false}
              animate={showShell ? { opacity: 1, scaleY: 1 } : { opacity: 0, scaleY: 0 }}
              transition={{ ...geometricTransition, delay: showShell && !reduceMotion ? 0.62 : 0, duration: reduceMotion ? 0.01 : 0.8 }}
            />
          </div>

          <motion.div
            className="admin-login__console admin-login__console--building"
            initial={false}
            animate={showShell
              ? { opacity: 1, clipPath: "inset(0 0% 0 0)" }
              : { opacity: 0, clipPath: "inset(0 100% 0 0)" }}
            transition={{ ...geometricTransition, delay: showShell && !reduceMotion ? 0.35 : 0, duration: reduceMotion ? 0.01 : 1 }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {showHeading ? (
                <motion.div key="heading" className="admin-login__heading-stage" {...stagedEntry(13)}>
                  <div className="admin-login__console-heading">
                    <div>
                      <p>AUTHORIZATION NODE</p>
                      <h1 id={titleId}>{copy.title}</h1>
                    </div>
                    <span className="admin-login__console-index" aria-hidden="true">
                      A-01
                    </span>
                  </div>

                  <p className="admin-login__description" id={descriptionId}>
                    {copy.description}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence initial={false} mode="popLayout">
              {showCredentials ? (
                <motion.form
                  key="credentials"
                  className="admin-login__form"
                  onSubmit={handleSubmit}
                  aria-describedby={descriptionId}
                  {...stagedEntry(14)}
                >
                  <motion.label className="admin-login__field" htmlFor={emailId}
                    initial={reduceMotion ? false : { opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ ...buildTransition, delay: reduceMotion ? 0 : 0.15 }}>
                    <span>{copy.emailLabel}</span>
                    <input
                      id={emailId}
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="username"
                      placeholder={copy.emailPlaceholder}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={submitting}
                      required
                    />
                  </motion.label>

                  <motion.label className="admin-login__field" htmlFor={passwordId}
                    initial={reduceMotion ? false : { opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ ...buildTransition, delay: reduceMotion ? 0 : 0.55 }}>
                    <span>{copy.passwordLabel}</span>
                    <input
                      id={passwordId}
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder={copy.passwordPlaceholder}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={submitting}
                      aria-describedby={feedback ? feedbackId : undefined}
                      required
                    />
                  </motion.label>

                  <AnimatePresence initial={false} mode="popLayout">
                    {showActions && feedback ? (
                      <motion.p key="feedback" className="admin-login__feedback" id={feedbackId} role="alert" {...stagedEntry(6)}>
                        {feedback}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>

                  <AnimatePresence initial={false} mode="popLayout">
                    {showActions ? (
                      <motion.div key="actions" className="admin-login__action-stage" {...stagedEntry(14)}>
                        <button className="admin-login__submit" type="submit" disabled={submitting} aria-busy={submitting}>
                          <span>{submitting ? copy.submitting : copy.submit}</span>
                          <i aria-hidden="true" />
                        </button>

                        <div className="admin-login__load-state" aria-live="polite">
                          <div>
                            <span>{submitting ? copy.statusLoading : copy.statusReady}</span>
                            <span>{submitting ? "···" : "100%"}</span>
                          </div>
                          <span className="admin-login__load-track" aria-hidden="true">
                            <motion.span
                              animate={submitting && !reduceMotion ? { scaleX: [0.18, 0.92, 0.38] } : { scaleX: 1 }}
                              transition={submitting && !reduceMotion ? { duration: 1.08, repeat: Infinity, ease: "easeInOut" } : { duration: 0.18 }}
                            />
                          </span>
                        </div>

                        <p className="admin-login__security-note">{copy.securityNote}</p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.form>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </div>
      </main>
    </section>
  );
}
