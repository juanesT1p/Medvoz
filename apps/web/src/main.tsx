import { StrictMode, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { Explanation, ExtractedItem, ExtractedPrescription, ValidatedPrescription, ValidatedItem } from '@medvoz/shared';
import { ApiError, explainPrescription, extractPrescription, validatePrescription } from './api/prescriptions.js';
import { useVoicePlayer, VOICE_SPEEDS } from './hooks/useVoicePlayer.js';
import './styles.css';

type Screen = 'capture' | 'confirm';
type EditableField = 'name' | 'dose' | 'frequency' | 'duration';

const editableFields: Array<{ key: EditableField; label: string; placeholder: string }> = [
  { key: 'name', label: 'Medicamento', placeholder: 'Ej. acetaminofén' },
  { key: 'dose', label: 'Dosis', placeholder: 'Ej. 1 tableta' },
  { key: 'frequency', label: 'Frecuencia', placeholder: 'Ej. cada 8 horas' },
  { key: 'duration', label: 'Duración', placeholder: 'Ej. por 3 días' },
];

function App() {
  const [screen, setScreen] = useState<Screen>('capture');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prescription, setPrescription] = useState<ExtractedPrescription | null>(null);
  const [validation, setValidation] = useState<ValidatedPrescription | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [confirmedItems, setConfirmedItems] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const chooseFile = (nextFile: File | undefined) => {
    if (!nextFile) return;
    setError(null);
    setConfirmed(false);
    setPrescription(null);
    setValidation(null);
    setExplanation(null);
    setFile(nextFile);
    setPreviewUrl((previousUrl) => {
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      return URL.createObjectURL(nextFile);
    });
  };

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(null);
    setPrescription(null);
    setValidation(null);
    setExplanation(null);
    setError(null);
  };

  const extract = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setConfirmed(false);
    try {
      const result = await extractPrescription(file);
      setPrescription(result);
      setValidation(null);
      setExplanation(null);
      setConfirmedItems(new Set());
      if (!result.isPrescription) {
        setError('La imagen no parece una fórmula médica. Toma una foto más clara y vuelve a intentarlo.');
        return;
      }
      setScreen('confirm');
    } catch (requestError) {
      const message = requestError instanceof ApiError ? requestError.message : 'No pudimos leer la imagen. Inténtalo de nuevo.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setScreen('capture');
    setPrescription(null);
    setValidation(null);
    setExplanation(null);
    setConfirmedItems(new Set());
    setConfirmed(false);
    setError(null);
  };

  const updateItem = (itemId: string, field: EditableField, value: string) => {
    setPrescription((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) => (item.id === itemId ? { ...item, [field]: value || null } : item)),
      };
    });
    setValidation(null);
    setExplanation(null);
    setConfirmed(false);
  };

  const addItem = () => {
    const newItem: ExtractedItem = {
      id: crypto.randomUUID(),
      rawText: '',
      name: '',
      activeIngredient: null,
      strength: null,
      form: null,
      dose: null,
      frequency: null,
      duration: null,
      route: null,
      instructions: null,
      confidence: 1,
      legibility: 'clear',
    };
    setPrescription((current) => (current ? { ...current, items: [...current.items, newItem] } : current));
    setValidation(null);
    setExplanation(null);
    setConfirmed(false);
  };

  const deleteItem = (itemId: string) => {
    setPrescription((current) => (current ? { ...current, items: current.items.filter((item) => item.id !== itemId) } : current));
    setValidation(null);
    setExplanation(null);
    setConfirmedItems((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
    setConfirmed(false);
  };

  const toggleItemConfirmation = (itemId: string) => {
    setConfirmedItems((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
    setConfirmed(false);
  };

  const validate = async () => {
    if (!prescription || !canConfirm) return;
    setValidating(true);
    setError(null);
    try {
      const result = await validatePrescription(prescription);
      setValidation(result);
      const hasUnverified = result.items.some((item) => item.match.status !== 'verified');
      if (hasUnverified) {
        setError('Hay medicamentos que no pudimos confirmar en el catálogo. La explicación será limitada; revisa el nombre y la dosis con un profesional antes de usarlos.');
      }
      const generatedExplanation = await explainPrescription(result);
      setExplanation(generatedExplanation);
      setConfirmed(true);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'No pudimos validar los medicamentos. Inténtalo de nuevo.');
    } finally {
      setValidating(false);
    }
  };

  const needsReview = (item: ExtractedItem) => item.legibility !== 'clear' || item.confidence < 0.7;
  const missingReview = prescription?.items.some((item) => needsReview(item) && !confirmedItems.has(item.id)) ?? true;
  const hasEmptyName = prescription?.items.some((item) => item.name.trim() === '') ?? true;
  const canConfirm = Boolean(prescription && prescription.items.length > 0 && !missingReview && !hasEmptyName);

  return (
    <main className="shell">
      <header className="brand-header">
        <p className="eyebrow">MedVoz</p>
        <p className="step-label" aria-live="polite">
          {screen === 'capture' ? 'Paso 1 de 2 · Foto' : 'Paso 2 de 2 · Confirmación'}
        </p>
      </header>

      {screen === 'capture' ? (
        <CaptureScreen file={file} previewUrl={previewUrl} loading={loading} error={error} consentGiven={consentGiven} onConsentChange={setConsentGiven} onChooseFile={chooseFile} onClearFile={clearFile} onExtract={extract} />
      ) : prescription ? (
        <ConfirmationScreen
          prescription={prescription}
          validation={validation}
          explanation={explanation}
          confirmedItems={confirmedItems}
          confirmed={confirmed}
          error={error}
          canConfirm={canConfirm}
          validating={validating}
          onUpdate={updateItem}
          onDelete={deleteItem}
          onAdd={addItem}
          onToggleConfirmation={toggleItemConfirmation}
          onConfirm={validate}
          onBack={reset}
        />
      ) : null}
    </main>
  );
}

function CaptureScreen({
  file,
  previewUrl,
  loading,
  error,
  consentGiven,
  onConsentChange,
  onChooseFile,
  onClearFile,
  onExtract,
}: {
  file: File | null;
  previewUrl: string | null;
  loading: boolean;
  error: string | null;
  consentGiven: boolean;
  onConsentChange: (value: boolean) => void;
  onChooseFile: (file: File | undefined) => void;
  onClearFile: () => void;
  onExtract: () => void;
}) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChooseFile(event.target.files?.[0]);

  return (
    <section className="panel capture-panel" aria-labelledby="capture-title">
      <div>
        <p className="eyebrow">Tu salud, más clara</p>
        <h1 id="capture-title">Entiende tu fórmula médica con claridad.</h1>
        <p className="intro">Toma una foto legible o sube una imagen. Revisarás los medicamentos antes de recibir una explicación.</p>
      </div>
      <div className="privacy-note" role="note">
        <span aria-hidden="true">⌁</span>
        <p>La imagen se procesa para esta lectura y no se guarda en tu dispositivo.</p>
      </div>
      <label className="consent-check">
        <input type="checkbox" checked={consentGiven} onChange={(event) => onConsentChange(event.target.checked)} />
        <span>Acepto que la imagen y el texto se procesen temporalmente con un proveedor externo de inteligencia artificial para esta demostración académica.</span>
      </label>
      {previewUrl ? (
        <div className="preview-wrap">
          <img src={previewUrl} alt="Vista previa de la fórmula seleccionada" className="prescription-preview" />
          <button className="text-button" type="button" onClick={onClearFile}>Elegir otra imagen</button>
        </div>
      ) : (
        <div className="empty-preview" aria-hidden="true"><span className="camera-icon">⌑</span><span>La foto aparecerá aquí</span></div>
      )}
      <div className="action-stack">
        <input ref={cameraInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" onChange={handleChange} />
        <input ref={uploadInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={handleChange} />
        <button className="button button-primary" type="button" disabled={!consentGiven} onClick={() => cameraInput.current?.click()}>Tomar foto</button>
        <button className="button button-secondary" type="button" disabled={!consentGiven} onClick={() => uploadInput.current?.click()}>Subir imagen</button>
        <button className="button button-submit" type="button" disabled={!file || loading || !consentGiven} onClick={onExtract}>{loading ? 'Leyendo fórmula…' : 'Leer fórmula'}</button>
      </div>
      {error ? <ErrorMessage message={error} /> : null}
      <p className="helper-text">Acepta JPEG, PNG, WebP o HEIC. Procura que toda la fórmula quede enfocada y visible.</p>
    </section>
  );
}

function ConfirmationScreen({
  prescription,
  validation,
  explanation,
  confirmedItems,
  confirmed,
  error,
  canConfirm,
  validating,
  onUpdate,
  onDelete,
  onAdd,
  onToggleConfirmation,
  onConfirm,
  onBack,
}: {
  prescription: ExtractedPrescription;
  validation: ValidatedPrescription | null;
  explanation: Explanation | null;
  confirmedItems: Set<string>;
  confirmed: boolean;
  error: string | null;
  canConfirm: boolean;
  validating: boolean;
  onUpdate: (itemId: string, field: EditableField, value: string) => void;
  onDelete: (itemId: string) => void;
  onAdd: () => void;
  onToggleConfirmation: (itemId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <section className="panel confirmation-panel" aria-labelledby="confirmation-title">
      <button className="back-button" type="button" onClick={onBack}>← Tomar otra foto</button>
      <div>
        <p className="eyebrow">Revisión necesaria</p>
        <h1 id="confirmation-title">Confirma lo que aparece en la fórmula.</h1>
        <p className="intro">Edita cualquier dato que no coincida. Los campos resaltados necesitan una confirmación explícita.</p>
      </div>
      {prescription.documentWarnings.length > 0 ? (
        <div className="warning-box" role="alert">
          <strong>Revisa la calidad de la foto</strong>
          <ul>{prescription.documentWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          <button className="text-button" type="button" onClick={onBack}>Repetir foto</button>
        </div>
      ) : null}
      <div className="items-list" aria-label="Medicamentos detectados">
        {prescription.items.map((item, index) => (
          <MedicationCard key={item.id} item={item} validation={validation?.items.find((validatedItem) => validatedItem.id === item.id)} index={index} requiresReview={item.legibility !== 'clear' || item.confidence < 0.7} isConfirmed={confirmedItems.has(item.id)} onUpdate={onUpdate} onDelete={onDelete} onToggleConfirmation={onToggleConfirmation} />
        ))}
      </div>
      <button className="add-item" type="button" onClick={onAdd}>＋ Agregar medicamento</button>
      {error ? <ErrorMessage message={error} /> : null}
      {confirmed ? <p className="success-message" role="status">Lista confirmada. Ya puedes continuar con la explicación.</p> : null}
      {explanation ? <ExplanationView explanation={explanation} prescription={prescription} /> : null}
      <button className="button button-submit" type="button" disabled={!canConfirm || confirmed || validating} onClick={onConfirm}>{validating ? 'Validando medicamentos…' : confirmed ? 'Lista confirmada' : 'Confirmar y explicar'}</button>
    </section>
  );
}

function ExplanationView({ explanation, prescription }: { explanation: Explanation; prescription: ExtractedPrescription }) {
  return (
    <section className="explanation-box" aria-labelledby="explanation-title">
      <p className="eyebrow">Análisis de la fórmula confirmada</p>
      <h2 id="explanation-title">Explicación de tus medicamentos</h2>
      {explanation.items.map((item) => {
        const prescriptionItem = prescription.items.find((candidate) => candidate.id === item.itemId);
        return (
          <article className="explanation-item" key={item.itemId}>
            <h3>{prescriptionItem?.name ?? 'Medicamento'}</h3>
            {prescriptionItem ? <p><strong>Datos leídos:</strong> {[prescriptionItem.strength, prescriptionItem.form, prescriptionItem.route].filter(Boolean).join(' · ') || 'No indicados en la fórmula.'}</p> : null}
            <p><strong>Para qué puede servir:</strong> {item.purpose}</p>
            <p><strong>Cómo usarlo según la fórmula:</strong> {item.howToTakeAsPrescribed}</p>
            <p><strong>Ten en cuenta:</strong> {item.commonWarnings.join(' ')}</p>
            <p><strong>Consulta si:</strong> {item.askDoctorIf.join(' ')}</p>
          </article>
        );
      })}
      <p className="audio-script"><strong>Guion:</strong> {explanation.audioScript}</p>
      <AudioPlayer audioScript={explanation.audioScript} disclaimer={explanation.disclaimer} />
    </section>
  );
}

function AudioPlayer({ audioScript, disclaimer }: { audioScript: string; disclaimer: string }) {
  const player = useVoicePlayer(audioScript);
  const words = audioScript.split(/\s+/).filter(Boolean);
  const currentWordIndex = player.duration > 0 ? Math.min(words.length - 1, Math.floor((player.currentTime / player.duration) * words.length)) : -1;

  return (
    <div className="audio-player" aria-labelledby="audio-title">
      <h3 id="audio-title">Escucha la explicación</h3>
      <div className="audio-controls">
        <button className="button button-primary audio-button" type="button" onClick={player.toggle} disabled={player.loading} aria-label={player.playing ? 'Pausar explicación' : 'Reproducir explicación'}>
          {player.loading ? 'Preparando audio…' : player.playing ? 'Pausar' : 'Reproducir'}
        </button>
        <button className="text-button" type="button" onClick={player.reset} disabled={player.loading}>Repetir</button>
        <label className="speed-control">Velocidad
          <select value={player.speed} onChange={(event) => player.setSpeed(Number(event.target.value))} aria-label="Velocidad de reproducción">
            {VOICE_SPEEDS.map((value) => <option value={value} key={value}>{value}×</option>)}
          </select>
        </label>
        <label className="speed-control">Fuente
          <select value={player.source} onChange={(event) => player.selectSource(event.target.value as 'cloud' | 'native')} aria-label="Fuente de voz">
            <option value="cloud">TTS Cloud</option>
            <option value="native">Voz nativa</option>
          </select>
        </label>
      </div>
      <audio ref={player.audioRef} className="audio-element" aria-hidden="true" />
      <div className="audio-progress" aria-label="Progreso del audio">
        <progress max="1" value={player.indeterminate ? undefined : player.progress} />
        <span>{player.indeterminate ? 'Avance aproximado' : `${formatAudioTime(player.currentTime)} de ${formatAudioTime(player.duration)}`}</span>
      </div>
      {player.notice ? <p className="audio-status" role="status" aria-live="polite">{player.notice}</p> : null}
      {player.error ? <ErrorMessage message={player.error} /> : null}
      <p className="sync-text" aria-live="polite">{words.map((word, index) => <span className={index <= currentWordIndex ? 'word-active' : ''} key={`${word}-${index}`}>{word} </span>)}</p>
      <p className="disclaimer">{disclaimer}</p>
    </div>
  );
}

function formatAudioTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function MedicationCard({
  item,
  validation,
  index,
  requiresReview,
  isConfirmed,
  onUpdate,
  onDelete,
  onToggleConfirmation,
}: {
  item: ExtractedItem;
  validation: ValidatedItem | undefined;
  index: number;
  requiresReview: boolean;
  isConfirmed: boolean;
  onUpdate: (itemId: string, field: EditableField, value: string) => void;
  onDelete: (itemId: string) => void;
  onToggleConfirmation: (itemId: string) => void;
}) {
  return (
    <article className={`medication-card${requiresReview ? ' medication-card-review' : ''}`}>
      <div className="card-heading">
        <div>
          <p className="card-number">Medicamento {index + 1}</p>
          {requiresReview ? <p className="review-label">Necesita revisión</p> : <p className="clear-label">Lectura clara</p>}
        </div>
        <button className="delete-button" type="button" onClick={() => onDelete(item.id)} aria-label={`Eliminar medicamento ${index + 1}`}>Eliminar</button>
      </div>
      {validation ? <ValidationBadge match={validation.match} /> : null}
      <div className="fields-grid">
        {editableFields.map(({ key, label, placeholder }) => (
          <label key={key}>
            <span>{label}</span>
            <input value={item[key] ?? ''} placeholder={placeholder} onChange={(event) => onUpdate(item.id, key, event.target.value)} aria-label={`${label} del medicamento ${index + 1}`} />
          </label>
        ))}
      </div>
      {requiresReview ? (
        <label className="confirm-check"><input type="checkbox" checked={isConfirmed} onChange={() => onToggleConfirmation(item.id)} /><span>Confirmo que revisé este medicamento y sus indicaciones.</span></label>
      ) : null}
    </article>
  );
}

function ValidationBadge({ match }: { match: ValidatedItem['match'] }) {
  const labels = {
    verified: 'Verificado en el catálogo',
    probable: `Coincidencia probable${match.canonicalName ? `: ${match.canonicalName}` : ''}. Revisa el nombre.`,
    not_found: 'No encontrado. Confirma el nombre con un profesional.',
  } as const;
  return <p className={`validation-badge validation-${match.status}`} role={match.status === 'verified' ? undefined : 'alert'}>{labels[match.status]}</p>;
}

function ErrorMessage({ message }: { message: string }) {
  return <p className="error-message" role="alert">{message}</p>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
