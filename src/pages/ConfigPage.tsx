import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Building2, ImagePlus, Lock, LogOut, Save, ShieldCheck, Trash2, User } from 'lucide-react';
import {
  clearConfigSession,
  getConfigLocations,
  getStoredConfigUser,
  hasStoredConfigSession,
  loginConfig,
  refreshConfigSession,
  removeLocationViewerLogo,
  resolveApiAssetUrl,
  updateLocationViewerBrand,
  updateLocationViewerLogo,
} from '../services';
import type { AuthUser, Location } from '../types';

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export function ConfigPage() {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredConfigUser());
  const [checkingSession, setCheckingSession] = useState(() => hasStoredConfigSession());

  useEffect(() => {
    function expireAuth() {
      setUser(null);
    }
    window.addEventListener('viewer-config-auth-expired', expireAuth);
    return () => window.removeEventListener('viewer-config-auth-expired', expireAuth);
  }, []);

  useEffect(() => {
    if (!hasStoredConfigSession()) {
      setCheckingSession(false);
      return;
    }

    void refreshConfigSession()
      .then(setUser)
      .catch(() => {
        clearConfigSession();
        setUser(null);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) {
    return <ConfigLoading />;
  }

  if (!user) {
    return <ConfigLogin onAuthenticated={setUser} />;
  }

  return <ConfigPanel user={user} onLogout={() => {
    clearConfigSession();
    setUser(null);
  }} />;
}

function ConfigLoading() {
  return (
    <main className="config-page config-page-centered">
      <div className="config-loader" aria-label="Validando sessão administrativa" />
    </main>
  );
}

function ConfigLogin({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      onAuthenticated(await loginConfig(username.trim(), password));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="config-page config-page-centered">
      <section className="config-login-card" aria-labelledby="config-login-title">
        <img src="/system-vision-logo.png" alt="System Vision" />
        <div className="config-login-heading">
          <ShieldCheck aria-hidden="true" />
          <div>
            <p>Área restrita</p>
            <h1 id="config-login-title">Identidade visual</h1>
          </div>
        </div>

        <form onSubmit={submit} className="config-form">
          <label htmlFor="config-username">Usuário, e-mail ou telefone</label>
          <div className="config-input-icon">
            <User aria-hidden="true" />
            <input
              id="config-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <label htmlFor="config-password">Senha</label>
          <div className="config-input-icon">
            <Lock aria-hidden="true" />
            <input
              id="config-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="config-message config-message-error" role="alert">{error}</p>}
          <button type="submit" className="config-primary-button" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar como SUPER_ADMIN'}
          </button>
        </form>
      </section>
    </main>
  );
}

function ConfigPanel({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [brandName, setBrandName] = useState('');
  const [pendingLogo, setPendingLogo] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedId),
    [locations, selectedId]
  );

  const currentLogo = pendingLogo ?? (
    selectedLocation?.viewerLogoUrl ? resolveApiAssetUrl(selectedLocation.viewerLogoUrl) : undefined
  );

  useEffect(() => {
    void getConfigLocations()
      .then((data) => {
        setLocations(data);
        setSelectedId(data[0]?.id ?? '');
        setBrandName(data[0]?.viewerBrandName ?? '');
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os locais.'))
      .finally(() => setLoading(false));
  }, []);

  function replaceLocation(updated: Location) {
    setLocations((current) => current.map((location) => location.id === updated.id ? updated : location));
  }

  async function selectLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage('');
    setError('');

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Escolha um logo JPG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('O logo deve ter no máximo 5 MB.');
      return;
    }

    try {
      setPendingLogo(await fileToDataUrl(file));
    } catch {
      setError('Não foi possível ler este arquivo.');
    }
  }

  async function saveIdentity(event: FormEvent) {
    event.preventDefault();
    if (!selectedLocation) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      let updated = await updateLocationViewerBrand(selectedLocation.id, brandName.trim() || null);
      if (pendingLogo) {
        updated = await updateLocationViewerLogo(selectedLocation.id, pendingLogo);
      }
      replaceLocation(updated);
      setPendingLogo(undefined);
      setMessage('Identidade visual salva.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function removeLogo() {
    if (!selectedLocation) return;
    if (pendingLogo) {
      setPendingLogo(undefined);
      setMessage('Seleção de logo cancelada.');
      setError('');
      return;
    }
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const updated = await removeLocationViewerLogo(selectedLocation.id);
      replaceLocation(updated);
      setPendingLogo(undefined);
      setMessage('Logo removido.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível remover o logo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="config-page">
      <header className="config-topbar">
        <div>
          <img src="/system-vision-emblem.png" alt="" />
          <div>
            <p>Transmissão Reservada</p>
            <h1>Identidade visual por local</h1>
          </div>
        </div>
        <div className="config-user">
          <span>{user.name}</span>
          <button type="button" onClick={onLogout}><LogOut aria-hidden="true" /> Sair</button>
        </div>
      </header>

      <section className="config-workspace">
        <aside className="config-location-panel">
          <div className="config-section-title">
            <Building2 aria-hidden="true" />
            <div><p>Banco principal</p><h2>Escolha o local</h2></div>
          </div>

          {loading ? (
            <p className="config-muted">Carregando locais...</p>
          ) : locations.length === 0 ? (
            <p className="config-muted">Nenhum local cadastrado.</p>
          ) : (
            <select value={selectedId} onChange={(event) => {
              const nextId = event.target.value;
              const nextLocation = locations.find((location) => location.id === nextId);
              setSelectedId(nextId);
              setBrandName(nextLocation?.viewerBrandName ?? '');
              setPendingLogo(undefined);
              setMessage('');
              setError('');
            }}>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          )}

          <p className="config-help">A câmera autorizada identifica o local e aplica automaticamente esta configuração.</p>
        </aside>

        <section className="config-editor">
          <div className="config-section-title">
            <ImagePlus aria-hidden="true" />
            <div><p>Viewer reservado</p><h2>Nome e logo</h2></div>
          </div>

          {selectedLocation ? (
            <form onSubmit={saveIdentity} className="config-form config-editor-form">
              <label htmlFor="viewer-brand-name">Nome exibido</label>
              <input
                id="viewer-brand-name"
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                maxLength={120}
                placeholder="Deixe vazio para não exibir nome"
              />

              <label>Logo</label>
              <div className="config-logo-row">
                <div className="config-logo-preview">
                  {currentLogo
                    ? <img src={currentLogo} alt="Prévia do logo" />
                    : <span>Sem logo</span>}
                </div>
                <div className="config-logo-actions">
                  <label className="config-file-button">
                    <ImagePlus aria-hidden="true" /> Escolher logo
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectLogo} />
                  </label>
                  {(currentLogo || pendingLogo) && (
                    <button type="button" className="config-danger-button" onClick={removeLogo} disabled={saving}>
                      <Trash2 aria-hidden="true" /> Remover logo
                    </button>
                  )}
                  <p>JPG, PNG ou WebP, até 5 MB. A proporção será preservada.</p>
                </div>
              </div>

              {message && <p className="config-message config-message-success">{message}</p>}
              {error && <p className="config-message config-message-error" role="alert">{error}</p>}

              <button type="submit" className="config-primary-button config-save-button" disabled={saving}>
                <Save aria-hidden="true" /> {saving ? 'Salvando...' : 'Salvar identidade'}
              </button>
            </form>
          ) : !loading && (
            <p className="config-muted">Selecione um local para configurar.</p>
          )}
        </section>
      </section>
    </main>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error());
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
