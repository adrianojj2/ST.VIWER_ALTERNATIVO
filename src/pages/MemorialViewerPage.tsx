import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound, Lock, User, Volume2, VolumeX } from 'lucide-react';
import {
  changePassword,
  clearSession,
  createStreamSession,
  endStreamSession,
  getCameras,
  getStoredAuthUser,
  hasStoredSession,
  heartbeatStreamSession,
  login,
  refreshSession,
} from '../services';
import type { AuthUser, Camera, StreamSession } from '../types';

const BRAND_NAME = 'FUNERÁRIA BOM JESUS';
const PLAYER_WARMUP_MS = 3_500;

function configurePlayerUrl(playerUrl: string, audioEnabled: boolean) {
  const url = new URL(playerUrl);
  url.searchParams.set('muted', audioEnabled ? 'false' : 'true');
  url.searchParams.set('autoplay', audioEnabled ? 'false' : 'true');
  url.searchParams.set('controls', audioEnabled ? 'true' : 'false');
  return url.toString();
}

function SeamlessPlayer({ url, title }: { url: string; title: string }) {
  const [activeUrl, setActiveUrl] = useState<string>();
  const [pendingUrl, setPendingUrl] = useState<string>();
  const promoteTimer = useRef<number>();

  useEffect(() => {
    window.clearTimeout(promoteTimer.current);
    if (url !== activeUrl && url !== pendingUrl) {
      setPendingUrl(url);
    }
    return () => window.clearTimeout(promoteTimer.current);
  }, [activeUrl, pendingUrl, url]);

  function promote(loadedUrl: string) {
    if (loadedUrl !== pendingUrl) return;
    window.clearTimeout(promoteTimer.current);
    promoteTimer.current = window.setTimeout(() => {
      setActiveUrl(loadedUrl);
      setPendingUrl((current) => current === loadedUrl ? undefined : current);
    }, PLAYER_WARMUP_MS);
  }

  const urls = [activeUrl, pendingUrl].filter(
    (playerUrl, index, all): playerUrl is string => Boolean(playerUrl) && all.indexOf(playerUrl) === index
  );

  return (
    <>
      {urls.map((playerUrl) => (
        <iframe
          key={playerUrl}
          src={playerUrl}
          title={title}
          allow="autoplay; picture-in-picture 'none'"
          onLoad={() => promote(playerUrl)}
          className={playerUrl === activeUrl || !activeUrl ? 'stream-player stream-player-visible' : 'stream-player'}
        />
      ))}
    </>
  );
}

const watermarkPositions = ['watermark-tl', 'watermark-tr', 'watermark-bl', 'watermark-br', 'watermark-center'];

function Watermark({ code }: { code?: string }) {
  const [position, setPosition] = useState(0);

  useEffect(() => {
    if (!code) return;
    const timer = window.setInterval(() => {
      setPosition((current) => (current + 1) % watermarkPositions.length);
    }, 25_000);
    return () => window.clearInterval(timer);
  }, [code]);

  if (!code) return null;
  return <span className={`watermark ${watermarkPositions[position]}`}>{code}</span>;
}

function LoginOverlay({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      onAuthenticated(await login(username.trim(), password));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Usuario ou senha invalidos.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-backdrop">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-brand">
          <div className="auth-brand-logo-wrap">
            <span aria-hidden="true" />
            <img src="/system-vision-logo.png" alt="System Vision" className="auth-system-logo" />
          </div>
          <p id="login-title">Plataforma de Monitoramento Compartilhado</p>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label htmlFor="username">Usuário, e-mail ou telefone</label>
          <div className="auth-input-wrap">
            <User aria-hidden="true" />
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder="Digite seu acesso"
              autoFocus
              required
            />
          </div>

          <label htmlFor="password">Senha</label>
          <div className="auth-input-wrap">
            <Lock aria-hidden="true" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Digite sua senha"
              required
            />
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="auth-restricted">Acesso restrito a usuários cadastrados.</p>
      </section>
    </div>
  );
}

function ChangePasswordOverlay({ user, onChanged }: { user: AuthUser; onChanged: (user: AuthUser) => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setError('As senhas nao conferem.');
      return;
    }
    if (newPassword.length < 4 || newPassword === '123') {
      setError('Escolha uma senha pessoal com pelo menos 4 caracteres.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      onChanged(await changePassword(newPassword, confirmation));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Nao foi possivel trocar a senha.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-backdrop">
      <section className="auth-card" aria-labelledby="password-title">
        <img src="/system-vision-emblem.png" alt="System Vision" className="auth-emblem" />
        <p className="auth-eyebrow">Primeiro acesso</p>
        <h2 id="password-title">Crie sua senha</h2>
        <p className="auth-copy">Olá, {user.name}. Defina sua senha pessoal para abrir a transmissão.</p>

        <form onSubmit={submit} className="auth-form">
          <label htmlFor="new-password">Nova senha</label>
          <div className="auth-input-wrap">
            <KeyRound aria-hidden="true" />
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Digite a nova senha"
              autoFocus
              required
            />
          </div>

          <label htmlFor="confirm-password">Confirmar nova senha</label>
          <div className="auth-input-wrap">
            <KeyRound aria-hidden="true" />
            <input
              id="confirm-password"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              placeholder="Confirme a nova senha"
              required
            />
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Salvar e continuar'}
          </button>
        </form>
      </section>
    </div>
  );
}

export function MemorialViewerPage() {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredAuthUser());
  const [checkingSession, setCheckingSession] = useState(() => hasStoredSession());
  const [camera, setCamera] = useState<Camera | null>(null);
  const [session, setSession] = useState<StreamSession | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [status, setStatus] = useState('Aguardando autenticação');
  const [streamError, setStreamError] = useState('');
  const refreshTimer = useRef<number>();
  const retryTimer = useRef<number>();
  const heartbeatTimer = useRef<number>();
  const sessionRef = useRef<StreamSession | null>(null);

  useEffect(() => {
    function expireAuth() {
      setUser(null);
      setCamera(null);
      setSession(null);
      setStatus('Aguardando autenticação');
    }
    window.addEventListener('funeraria-auth-expired', expireAuth);
    return () => window.removeEventListener('funeraria-auth-expired', expireAuth);
  }, []);

  useEffect(() => {
    if (!hasStoredSession()) {
      setCheckingSession(false);
      return;
    }

    void refreshSession()
      .then(setUser)
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!user || user.mustChangePassword) return;
    setAudioEnabled(false);
    let active = true;
    setStatus('Localizando câmera autorizada...');
    setStreamError('');

    void getCameras()
      .then((cameras) => {
        if (!active) return;
        if (cameras.length !== 1) {
          setCamera(null);
          setStatus('');
          setStreamError(
            cameras.length === 0
              ? 'Esta conta ainda nao possui uma camera autorizada.'
              : 'Esta conta precisa ter acesso a exatamente uma camera.'
          );
          return;
        }
        setCamera(cameras[0]);
      })
      .catch((reason) => {
        if (!active) return;
        setStatus('');
        setStreamError(reason instanceof Error ? reason.message : 'Nao foi possivel localizar a camera.');
      });

    return () => {
      active = false;
    };
  }, [user]);

  const openSession = useCallback(async (showStatus = true, reconnect = false) => {
    window.clearTimeout(refreshTimer.current);
    window.clearTimeout(retryTimer.current);
    if (!camera) return;
    if (showStatus) setStatus('Conectando transmissão...');
    setStreamError('');

    try {
      const nextSession = await createStreamSession(camera.id, {
        viewSessionId: sessionRef.current?.viewSessionId,
        reconnect,
      });
      sessionRef.current = nextSession;
      setSession(nextSession);
      setStatus('');

      const expiresIn = new Date(nextSession.expiresAt).getTime() - Date.now();
      const refreshIn = Math.max(30_000, Math.min(expiresIn * 0.85, expiresIn - 30_000));
      refreshTimer.current = window.setTimeout(() => void openSession(false), refreshIn);
    } catch (reason) {
      if (!sessionRef.current) {
        setStatus('');
        setStreamError(reason instanceof Error ? reason.message : 'Nao foi possivel abrir a transmissão.');
      }
      retryTimer.current = window.setTimeout(() => void openSession(false, Boolean(sessionRef.current)), 10_000);
    }
  }, [camera]);

  useEffect(() => {
    if (!camera) return;
    void openSession();

    heartbeatTimer.current = window.setInterval(() => {
      const activeSession = sessionRef.current;
      if (activeSession) {
        void heartbeatStreamSession(camera.id, activeSession.viewSessionId).catch(() => undefined);
      }
    }, 120_000);

    const reconnect = () => void openSession(false, true);
    const closeSession = () => {
      const activeSession = sessionRef.current;
      if (activeSession) {
        void endStreamSession(camera.id, activeSession.viewSessionId, true).catch(() => undefined);
      }
    };

    window.addEventListener('online', reconnect);
    window.addEventListener('pagehide', closeSession);

    return () => {
      window.clearTimeout(refreshTimer.current);
      window.clearTimeout(retryTimer.current);
      window.clearInterval(heartbeatTimer.current);
      window.removeEventListener('online', reconnect);
      window.removeEventListener('pagehide', closeSession);
      const activeSession = sessionRef.current;
      sessionRef.current = null;
      if (activeSession) {
        void endStreamSession(camera.id, activeSession.viewSessionId).catch(() => undefined);
      }
    };
  }, [camera, openSession]);

  const canUseAudio = Boolean(user?.capabilities?.audio);
  const configuredPlayerUrl = session?.playerUrl
    ? configurePlayerUrl(session.playerUrl, canUseAudio && audioEnabled)
    : undefined;
  const mixedContent = Boolean(
    configuredPlayerUrl && window.location.protocol === 'https:' && configuredPlayerUrl.startsWith('http:')
  );

  return (
    <main className="memorial-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className="memorial-frame">
        <header className="brand-header">
          <img src="/funeraria-logo.png" alt="Pássaro da Funerária Bom Jesus" className="brand-logo" />
          <div>
            <p>Transmissão reservada</p>
            <h1>{BRAND_NAME}</h1>
          </div>
        </header>

        <div className="ornament"><span /></div>

        <section className="portrait-frame" aria-label="Transmissão ao vivo">
          <div className="portrait-mat">
            <div className="video-stage">
              {configuredPlayerUrl && !mixedContent ? (
                <SeamlessPlayer url={configuredPlayerUrl} title={camera?.name ?? 'Transmissão ao vivo'} />
              ) : (
                <div className="stream-state">
                  <img src="/funeraria-logo.png" alt="" />
                  <p>{mixedContent ? 'A transmissão requer uma conexão segura.' : streamError || status}</p>
                </div>
              )}
              {status && configuredPlayerUrl && <div className="stream-status">{status}</div>}
              <Watermark code={session?.watermarkCode} />
              {canUseAudio && configuredPlayerUrl && !mixedContent && (
                <button
                  type="button"
                  className={`audio-toggle${audioEnabled ? ' audio-toggle-active' : ''}`}
                  onClick={() => setAudioEnabled((current) => !current)}
                  aria-label={audioEnabled ? 'Desativar áudio' : 'Ativar áudio'}
                  title={audioEnabled ? 'Desativar áudio' : 'Ativar áudio'}
                >
                  {audioEnabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
                </button>
              )}
            </div>
          </div>
        </section>

        <footer className="memorial-footer">
          <span />
          <p>Respeito, serenidade e acolhimento</p>
          <span />
        </footer>
      </section>

      {checkingSession && (
        <div className="auth-backdrop">
          <div className="session-loader" aria-label="Validando sessão" />
        </div>
      )}
      {!checkingSession && !user && <LoginOverlay onAuthenticated={setUser} />}
      {!checkingSession && user?.mustChangePassword && (
        <ChangePasswordOverlay user={user} onChanged={setUser} />
      )}
    </main>
  );
}
