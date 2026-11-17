import { StrictMode, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, TouchEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { Explanation, ExtractedItem, ExtractedPrescription, ValidatedItem, ValidatedPrescription } from '@medvoz/shared';
import { ApiError, explainPrescription, extractPrescription, validatePrescription } from './api/prescriptions.js';
import { useVoicePlayer, VOICE_SPEEDS } from './hooks/useVoicePlayer.js';
import './styles.css';
import '@fontsource-variable/plus-jakarta-sans';

type Screen = 'capture' | 'review' | 'guide';
type Theme = 'light' | 'dark';
type EditableField = 'name' | 'form' | 'dose' | 'frequency' | 'route' | 'duration' | 'instructions';
type ReviewTab = 'image' | 'medicines';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const editableFields: Array<{ key: EditableField; label: string; placeholder: string }> = [
  { key: 'name', label: 'Nombre', placeholder: 'Ej. acetaminofén' },
  { key: 'form', label: 'Presentación', placeholder: 'Ej. tableta de 500 mg' },
  { key: 'dose', label: 'Dosis por toma', placeholder: 'Ej. 1 tableta' },
  { key: 'frequency', label: 'Frecuencia', placeholder: 'Ej. cada 8 horas' },
  { key: 'route', label: 'Vía', placeholder: 'Ej. oral' },
  { key: 'duration', label: 'Duración', placeholder: 'Ej. por 3 días' },
  { key: 'instructions', label: 'Instrucciones', placeholder: 'Solo si aparecen en la fórmula' },
];

const examples = [
  { title: 'Ejemplo 1', detail: 'Fórmula de demostración', src: exampleImage('Acetaminofén', '500 mg · cada 8 horas') },
  { title: 'Ejemplo 2', detail: 'Concentración líquida', src: exampleImage('Solución oral', '250 mg / 5 ml') },
];

function App() {
  const [screen, setScreen] = useState<Screen>('capture');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prescription, setPrescription] = useState<ExtractedPrescription | null>(null);
  const [validation, setValidation] = useState<ValidatedPrescription | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [confirmedItems, setConfirmedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => readPreference<Theme>('medvoz-theme', 'light'));
  const [textScale, setTextScale] = useState(1);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('medvoz-theme', theme);
  }, [theme]);

  useEffect(() => {
    const storedScale = readPreference<number>('medvoz-text-scale', 1);
    setTextScale(storedScale === 1.15 ? 1.15 : 1);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--text-scale', String(textScale));
    localStorage.setItem('medvoz-text-scale', String(textScale));
  }, [textScale]);

  const chooseFile = (nextFile: File | undefined) => {
    if (!nextFile) return;
    if (nextFile.size > MAX_IMAGE_BYTES) {
      setError('La imagen pesa más de 10 MB. Elige una foto más liviana para continuar.');
      return;
    }
    if (!acceptedImageTypes.has(nextFile.type.toLowerCase())) {
      setError('Usa una imagen JPEG, PNG, WebP o HEIC para leer la fórmula.');
      return;
    }
    setError(null);
    setFile(nextFile);
    setPrescription(null);
    setValidation(null);
    setExplanation(null);
    setConfirmedItems(new Set());
    setPreviewUrl((previousUrl) => {
      if (previousUrl?.startsWith('blob:')) URL.revokeObjectURL(previousUrl);
      return URL.createObjectURL(nextFile);
    });
  };

  const clearFile = () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(null);
    setPrescription(null);
    setValidation(null);
    setExplanation(null);
    setError(null);
  };

  const extract = async () => {
    if (!file || !consentGiven) return;
    setLoading(true);
    setError(null);
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
      setScreen('review');
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'No pudimos leer la imagen. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (itemId: string, field: EditableField, value: string) => {
    setPrescription((current) => current ? {
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, [field]: value || null } : item),
    } : current);
    setValidation(null);
    setExplanation(null);
  };

  const addItem = () => {
    const newItem: ExtractedItem = {
      id: crypto.randomUUID(), rawText: '', name: '', activeIngredient: null, strength: null, form: null,
      dose: null, frequency: null, duration: null, route: null, instructions: null,
      confidence: 1, legibility: 'clear',
    };
    setPrescription((current) => current ? { ...current, items: [...current.items, newItem] } : current);
    setValidation(null);
    setExplanation(null);
  };

  const deleteItem = (itemId: string) => {
    setPrescription((current) => current ? { ...current, items: current.items.filter((item) => item.id !== itemId) } : current);
    setValidation(null);
    setExplanation(null);
    setConfirmedItems((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  };

  const toggleItemConfirmation = (itemId: string) => {
    setConfirmedItems((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const needsReview = (item: ExtractedItem) => item.legibility !== 'clear' || item.confidence < 0.7;
  const canConfirm = Boolean(
    prescription && prescription.items.length > 0 &&
    prescription.items.every((item) => item.name.trim() !== '' && (!needsReview(item) || confirmedItems.has(item.id))),
  );

  const confirmPrescription = async () => {
    if (!prescription || !canConfirm) return;
    setValidating(true);
    setError(null);
    try {
      const result = await validatePrescription(prescription);
      setValidation(result);
      if (result.items.some((item) => item.match.status !== 'verified')) {
        setError('Algunos nombres requieren verificación profesional. Puedes leer la guía, pero no uses un medicamento si el nombre no coincide.');
      }
      const generatedExplanation = await explainPrescription(result);
      setExplanation(generatedExplanation);
      setScreen('guide');
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'No pudimos generar la guía. Inténtalo de nuevo.');
    } finally {
      setValidating(false);
    }
  };

  const restart = () => {
    clearFile();
    setConfirmedItems(new Set());
    setScreen('capture');
  };

  return (
    <div className="app-shell">
      <Header screen={screen} textScale={textScale} theme={theme} onScaleChange={setTextScale} onThemeChange={setTheme} />
      <main className="main-content">
        {screen === 'capture' ? <CaptureView file={file} previewUrl={previewUrl} loading={loading} error={error} consentGiven={consentGiven} onConsentChange={setConsentGiven} onChooseFile={chooseFile} onClearFile={clearFile} onExtract={extract} /> : null}
        {screen === 'review' && prescription ? <ReviewView prescription={prescription} validation={validation} confirmedItems={confirmedItems} error={error} canConfirm={canConfirm} validating={validating} previewUrl={previewUrl} onUpdate={updateItem} onDelete={deleteItem} onAdd={addItem} onToggleConfirmation={toggleItemConfirmation} onConfirm={confirmPrescription} onBack={restart} /> : null}
        {screen === 'guide' && prescription && validation && explanation ? <GuideView prescription={prescription} validation={validation} explanation={explanation} error={error} onBack={() => setScreen('review')} onRestart={restart} /> : null}
      </main>
    </div>
  );
}

function Header({ screen, textScale, theme, onScaleChange, onThemeChange }: { screen: Screen; textScale: number; theme: Theme; onScaleChange: (scale: number) => void; onThemeChange: (theme: Theme) => void }) {
  const labels: Record<Screen, string> = { capture: 'Paso 1 de 3 · Cargar', review: 'Paso 2 de 3 · Revisar', guide: 'Paso 3 de 3 · Escuchar' };
  return <header className="site-header"><a className="brand" href="#contenido-principal" aria-label="MedVoz, ir al contenido principal"><LogoMark /><span>MedVoz</span></a><div className="header-tools"><span className="step-label" aria-live="polite">{labels[screen]}</span><div className="tool-group" aria-label="Tamaño de texto"><button className="icon-button" type="button" onClick={() => onScaleChange(1)} aria-label="Reducir tamaño de texto A−" aria-pressed={textScale === 1}>A−</button><button className="icon-button" type="button" onClick={() => onScaleChange(1.15)} aria-label="Aumentar tamaño de texto A+" aria-pressed={textScale === 1.15}>A+</button></div><button className="icon-button theme-button" type="button" onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}><Icon name={theme === 'light' ? 'moon' : 'sun'} /></button></div></header>;
}

function CaptureView({ file, previewUrl, loading, error, consentGiven, onConsentChange, onChooseFile, onClearFile, onExtract }: { file: File | null; previewUrl: string | null; loading: boolean; error: string | null; consentGiven: boolean; onConsentChange: (value: boolean) => void; onChooseFile: (file: File | undefined) => void; onClearFile: () => void; onExtract: () => void }) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChooseFile(event.target.files?.[0]);
  const handleDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); onChooseFile(event.dataTransfer.files[0]); };
  return <section className="capture-view" id="contenido-principal" aria-labelledby="capture-title"><div className="hero-copy"><p className="eyebrow">Salud digital con calma</p><h1 id="capture-title">Entiende tu receta médica con total claridad y escúchala a tu ritmo</h1><p className="intro">MedVoz lee la fórmula, te permite revisar cada dato y prepara una guía sencilla. Tú confirmas antes de continuar.</p><div className="privacy-badge"><Icon name="shield" /><span>Procesamiento seguro y efímero en memoria</span></div></div><div className="capture-layout"><div className="surface upload-surface"><div className={`dropzone${dragging ? ' is-dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={handleDrop}><input ref={cameraInput} className="visually-hidden" type="file" aria-label="Elegir una foto con cámara" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={handleChange} /><input ref={uploadInput} className="visually-hidden" type="file" aria-label="Elegir una imagen desde el dispositivo" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={handleChange} />{previewUrl ? <img className="upload-preview" src={previewUrl} alt="Vista previa de la fórmula seleccionada" /> : <div className="upload-placeholder"><span className="upload-icon"><Icon name="upload" /></span><strong>Arrastra tu fórmula aquí</strong><span>o elige una imagen desde tu dispositivo</span></div>}<div className="upload-actions"><button className="button button-secondary" type="button" onClick={() => cameraInput.current?.click()} disabled={!consentGiven}><Icon name="camera" /> Tomar foto</button><button className="button button-secondary" type="button" onClick={() => uploadInput.current?.click()} disabled={!consentGiven}><Icon name="image" /> Subir imagen</button></div></div>{file ? <div className="selected-file"><span><Icon name="check" /> {file.name}</span><button className="text-button" type="button" onClick={onClearFile}>Elegir otra</button></div> : null}<p className="helper-text">JPEG, PNG, WebP o HEIC · máximo 10 MB. Procura que toda la fórmula quede enfocada y visible.</p><label className="consent-check"><input type="checkbox" checked={consentGiven} onChange={(event) => onConsentChange(event.target.checked)} /><span>Acepto que esta imagen se procese temporalmente con un proveedor externo de inteligencia artificial para esta demostración académica.</span></label><button className="button button-primary button-wide" type="button" disabled={!file || loading || !consentGiven} onClick={onExtract}>{loading ? <><span className="spinner" aria-hidden="true" /> Leyendo fórmula…</> : <>Leer mi fórmula <Icon name="arrow" /></>}</button>{error ? <ErrorMessage message={error} /> : null}</div><ExamplesPanel /></div></section>;
}

function ExamplesPanel() {
  return <aside className="examples-panel" aria-labelledby="examples-title"><div><p className="eyebrow">Para conocer el flujo</p><h2 id="examples-title">Prueba con un ejemplo</h2><p>Imágenes ficticias, sin datos de pacientes. Sirven para explorar la vista.</p></div><div className="example-list">{examples.map((example) => <div className="example-card" key={example.title}><img src={example.src} alt="" /><span><strong>{example.title}</strong><small>{example.detail}</small></span><Icon name="check" /></div>)}</div></aside>;
}

function ReviewView({ prescription, validation, confirmedItems, error, canConfirm, validating, previewUrl, onUpdate, onDelete, onAdd, onToggleConfirmation, onConfirm, onBack }: { prescription: ExtractedPrescription; validation: ValidatedPrescription | null; confirmedItems: Set<string>; error: string | null; canConfirm: boolean; validating: boolean; previewUrl: string | null; onUpdate: (itemId: string, field: EditableField, value: string) => void; onDelete: (itemId: string) => void; onAdd: () => void; onToggleConfirmation: (itemId: string) => void; onConfirm: () => void; onBack: () => void }) {
  const [tab, setTab] = useState<ReviewTab>('medicines');
  return <section className="review-view" id="contenido-principal" aria-labelledby="review-title"><div className="view-heading"><button className="back-link" type="button" onClick={onBack}><Icon name="arrow-left" /> Cargar otra foto</button><div><p className="eyebrow">Revisión antes de explicar</p><h1 id="review-title">Revisa lo que leímos</h1><p className="intro">Edita cualquier dato que no coincida. MedVoz no completa información que no aparece en tu fórmula.</p></div></div><div className="mobile-tabs" role="tablist" aria-label="Contenido de revisión"><button role="tab" aria-selected={tab === 'image'} className={tab === 'image' ? 'is-active' : ''} onClick={() => setTab('image')}>Ver fórmula</button><button role="tab" aria-selected={tab === 'medicines'} className={tab === 'medicines' ? 'is-active' : ''} onClick={() => setTab('medicines')}>Medicamentos</button></div><div className="review-grid"><PrescriptionViewer previewUrl={previewUrl} hiddenOnMobile={tab !== 'image'} /><div className={`medicines-column${tab !== 'medicines' ? ' mobile-hidden' : ''}`}>{prescription.documentWarnings.length > 0 ? <div className="warning-box"><Icon name="alert" /><div><strong>Revisa la calidad de la foto</strong><ul>{prescription.documentWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div></div> : null}<div className="section-heading"><div><p className="eyebrow">{prescription.items.length} {prescription.items.length === 1 ? 'medicamento detectado' : 'medicamentos detectados'}</p><h2>Confirma cada tarjeta</h2></div><button className="text-button" type="button" onClick={onAdd}><Icon name="plus" /> Agregar medicamento</button></div><div className="items-list">{prescription.items.map((item, index) => <MedicationCard key={item.id} item={item} validation={validation?.items.find((candidate) => candidate.id === item.id)} index={index} requiresReview={item.legibility !== 'clear' || item.confidence < 0.7} isConfirmed={confirmedItems.has(item.id)} onUpdate={onUpdate} onDelete={onDelete} onToggleConfirmation={onToggleConfirmation} />)}</div>{error ? <ErrorMessage message={error} /> : null}<button className="button button-primary button-wide" type="button" disabled={!canConfirm || validating} onClick={onConfirm}>{validating ? <><span className="spinner" aria-hidden="true" /> Validando y preparando guía…</> : <>Confirmar y generar guía fácil <Icon name="arrow" /></>}</button>{!canConfirm ? <p className="helper-text">Completa el nombre de cada medicamento y confirma los campos que necesitan revisión.</p> : null}</div></div></section>;
}

function PrescriptionViewer({ previewUrl, hiddenOnMobile }: { previewUrl: string | null; hiddenOnMobile: boolean }) {
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const touchDistance = useRef<number | null>(null);
  const updatePinch = (event: TouchEvent<HTMLDivElement>) => { if (event.touches.length !== 2) return; const distance = Math.hypot(event.touches[0]!.clientX - event.touches[1]!.clientX, event.touches[0]!.clientY - event.touches[1]!.clientY); if (touchDistance.current !== null) setZoom((current) => clamp(current + (distance - touchDistance.current!) / 500, 0.75, 2.5)); touchDistance.current = distance; };
  return <div className={`viewer-panel surface${hiddenOnMobile ? ' mobile-hidden' : ''}`}><div className="section-heading"><div><p className="eyebrow">Documento original</p><h2>Tu fórmula</h2></div><span className="small-badge"><Icon name="lock" /> Solo en memoria</span></div><div className="viewer-toolbar" aria-label="Controles de la fórmula"><button className="icon-button" type="button" onClick={() => setZoom((value) => clamp(value - 0.15, 0.75, 2.5))} aria-label="Alejar fórmula">−</button><span aria-live="polite">{Math.round(zoom * 100)}%</span><button className="icon-button" type="button" onClick={() => setZoom((value) => clamp(value + 0.15, 0.75, 2.5))} aria-label="Acercar fórmula">+</button><button className="text-button" type="button" onClick={() => { setZoom(1); setBrightness(100); setContrast(100); }}>Restablecer</button></div><div className="viewer-canvas" onWheel={(event) => { event.preventDefault(); setZoom((value) => clamp(value + (event.deltaY < 0 ? 0.08 : -0.08), 0.75, 2.5)); }} onTouchMove={updatePinch} onTouchEnd={() => { touchDistance.current = null; }}>{previewUrl ? <img src={previewUrl} alt="Fórmula médica original para comparar" style={{ transform: `scale(${zoom})`, filter: `brightness(${brightness}%) contrast(${contrast}%)` }} /> : <EmptyState title="No hay imagen disponible" message="Vuelve a cargar la foto para verla aquí." />}</div><div className="adjustment-controls"><label>Brillo <input type="range" min="70" max="140" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} /></label><label>Contraste <input type="range" min="70" max="160" value={contrast} onChange={(event) => setContrast(Number(event.target.value))} /></label></div><p className="helper-text">Usa los botones, la rueda del mouse o pellizca la imagen para acercarla.</p></div>;
}

function MedicationCard({ item, validation, index, requiresReview, isConfirmed, onUpdate, onDelete, onToggleConfirmation }: { item: ExtractedItem; validation: ValidatedItem | undefined; index: number; requiresReview: boolean; isConfirmed: boolean; onUpdate: (itemId: string, field: EditableField, value: string) => void; onDelete: (itemId: string) => void; onToggleConfirmation: (itemId: string) => void }) {
  const matchLabel = validation ? validation.match.status === 'verified' ? 'Validado en catálogo / openFDA' : validation.match.status === 'probable' ? 'Requiere verificación' : 'No encontrado: requiere verificación' : 'Pendiente de validar';
  const sourceLabel = validation?.match.source === 'local_catalog' ? 'Catálogo local' : validation?.match.source === 'rxnorm' ? 'RxNorm' : validation?.match.source === 'openfda' ? 'openFDA' : null;
  return <article className={`medication-card${requiresReview ? ' medication-card-review' : ''}`}><div className="card-heading"><div><p className="card-number">Medicamento {index + 1}</p><p className={requiresReview ? 'review-label' : 'clear-label'}>{requiresReview ? <><Icon name="alert" /> Necesita confirmación</> : <><Icon name="check" /> Lectura clara</>}</p></div><button className="delete-button" type="button" onClick={() => onDelete(item.id)} aria-label={`Eliminar medicamento ${index + 1}`}>Eliminar</button></div><p className={`validation-badge validation-${validation?.match.status ?? 'pending'}`} role={validation?.match.status === 'verified' ? 'status' : 'alert'}><Icon name={validation?.match.status === 'verified' ? 'check' : 'alert'} /> {matchLabel}{sourceLabel ? <small> · Fuente: {sourceLabel}</small> : null}</p><div className="fields-grid">{editableFields.map((field) => <FieldInput key={field.key} item={item} field={field} onUpdate={onUpdate} />)}</div>{requiresReview ? <label className="confirm-check"><input type="checkbox" checked={isConfirmed} onChange={() => onToggleConfirmation(item.id)} /><span>Confirmo que estos datos coinciden con la fórmula.</span></label> : null}</article>;
}

function FieldInput({ item, field, onUpdate }: { item: ExtractedItem; field: { key: EditableField; label: string; placeholder: string }; onUpdate: (itemId: string, field: EditableField, value: string) => void }) {
  const value = item[field.key] ?? '';
  const fieldId = `${item.id}-${field.key}`;
  const invalid = field.key === 'name' && value.trim() === '';
  return <label htmlFor={fieldId}>{field.label}<input id={fieldId} value={value} placeholder={field.placeholder} onChange={(event) => onUpdate(item.id, field.key, event.target.value)} aria-invalid={invalid} aria-describedby={invalid ? `${fieldId}-error` : undefined} />{invalid ? <small id={`${fieldId}-error`} className="field-error">Escribe el nombre que aparece en la fórmula.</small> : null}</label>;
}

function GuideView({ prescription, validation, explanation, error, onBack, onRestart }: { prescription: ExtractedPrescription; validation: ValidatedPrescription; explanation: Explanation; error: string | null; onBack: () => void; onRestart: () => void }) {
  return <section className="guide-view" id="contenido-principal" aria-labelledby="guide-title"><div className="view-heading guide-heading"><div><button className="back-link" type="button" onClick={onBack}><Icon name="arrow-left" /> Editar datos confirmados</button><p className="eyebrow">Tu guía fácil</p><h1 id="guide-title">Escucha y revisa tu fórmula</h1><p className="intro">Esta guía explica únicamente los datos que confirmaste y las coincidencias encontradas.</p></div><button className="button button-secondary" type="button" onClick={onRestart}>Nueva fórmula</button></div>{error ? <ErrorMessage message={error} /> : null}<div className="sticky-audio"><AudioPlayer audioScript={explanation.audioScript} disclaimer={explanation.disclaimer} /></div><div className="timeline-section"><div className="section-heading"><div><p className="eyebrow">Cronograma de dosis</p><h2>Lo que indica la frecuencia</h2></div></div><div className="timeline-list">{validation.items.map((item) => <ScheduleCard key={item.id} item={item} />)}</div></div><div className="guide-cards">{explanation.items.map((item) => <ExplanationCard key={item.itemId} explanation={item} item={validation.items.find((candidate) => candidate.id === item.itemId)} />)}</div><div className="safety-banner"><Icon name="alert" /><p><strong>Prototipo académico.</strong> MedVoz no diagnostica ni reemplaza el criterio de tu médico o farmacéutico. No cambies dosis ni tratamiento por tu cuenta.</p></div><p className="privacy-footnote"><Icon name="shield" /> Tu fórmula permanece en esta sesión y no se guarda en el dispositivo.</p><span className="sr-only">La explicación corresponde a la fórmula confirmada por ti.</span>{prescription.items.length === 0 ? <EmptyState title="No hay medicamentos" message="Vuelve a revisar la imagen." /> : null}</section>;
}

function AudioPlayer({ audioScript, disclaimer }: { audioScript: string; disclaimer: string }) {
  const player = useVoicePlayer(audioScript);
  return <div className="audio-player" aria-labelledby="audio-title"><div className="audio-title-row"><div><p className="eyebrow">Audio de la guía</p><h2 id="audio-title">Escúchala a tu ritmo</h2></div><span className="audio-source"><Icon name="volume" /> {player.source === 'cloud' ? 'TTS Cloud' : 'Voz nativa'}</span></div><div className="audio-controls"><button className="play-button" type="button" onClick={player.toggle} disabled={player.loading} aria-label={player.playing ? 'Pausar explicación' : 'Reproducir explicación'}>{player.loading ? <span className="spinner" aria-hidden="true" /> : <Icon name={player.playing ? 'pause' : 'play'} />}</button><div className="audio-progress-wrap"><progress max="1" value={player.indeterminate ? undefined : player.progress} aria-label="Progreso de reproducción" /><span>{player.indeterminate ? 'Avance aproximado' : `${formatAudioTime(player.currentTime)} de ${formatAudioTime(player.duration)}`}</span></div></div><div className="audio-options"><label>Velocidad <select value={player.speed} onChange={(event) => player.setSpeed(Number(event.target.value))} aria-label="Velocidad de reproducción">{VOICE_SPEEDS.map((speed) => <option key={speed} value={speed}>{speed}×</option>)}</select></label><label>Fuente <select value={player.source} onChange={(event) => player.selectSource(event.target.value as 'cloud' | 'native')} aria-label="Fuente de audio"><option value="cloud">TTS Cloud</option><option value="native">Voz nativa</option></select></label><button className="text-button" type="button" onClick={player.reset} disabled={player.loading}>Repetir</button></div><audio ref={player.audioRef} className="audio-element" aria-hidden="true" />{player.notice ? <p className="audio-status" role="status" aria-live="polite">{player.notice}</p> : null}{player.error ? <ErrorMessage message={player.error} /> : null}<details className="audio-transcript"><summary>Ver texto completo del audio</summary><p><strong>Texto de esta guía:</strong> {audioScript}</p></details><p className="disclaimer">{disclaimer}</p></div>;
}

function ScheduleCard({ item }: { item: ValidatedItem }) {
  const schedule = scheduleFromFrequency(item.frequency);
  return <article className="schedule-card"><div className="schedule-title"><Icon name="pill" /><div><h3>{item.name}</h3><p>{item.frequency || 'Frecuencia no indicada'}</p></div></div>{schedule ? <div className="schedule-pills">{schedule.map((label) => <span key={label}>{label}</span>)}</div> : <p className="schedule-uncertain"><Icon name="alert" /> Consulta con tu médico o farmacéutico el horario; la frecuencia no permite inferirlo con certeza.</p>}</article>;
}

function ExplanationCard({ explanation, item }: { explanation: Explanation['items'][number]; item: ValidatedItem | undefined }) {
  const [open, setOpen] = useState(true);
  const panelId = `explanation-${explanation.itemId}`;
  return <article className="guide-card"><button className="accordion-trigger" type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}><span><Icon name="pill" /><strong>{item?.name ?? 'Medicamento'}</strong></span><Icon name={open ? 'chevron-up' : 'chevron-down'} /></button>{open ? <div id={panelId} className="accordion-content"><section><h3>¿Para qué puede servir?</h3><p>{explanation.purpose}</p></section><section><h3>Instrucciones de toma y duración</h3><p>{explanation.howToTakeAsPrescribed}</p></section><section className="precautions"><h3><Icon name="alert" /> Precauciones y advertencias</h3><p>{explanation.commonWarnings.join(' ')}</p></section><section><h3>Preguntas para tu profesional de salud</h3><ul>{explanation.askDoctorIf.map((question) => <li key={question}>{question}</li>)}</ul></section></div> : null}</article>;
}

function scheduleFromFrequency(frequency: string | null): string[] | null {
  if (!frequency) return null;
  const normalized = frequency.toLowerCase();
  const interval = normalized.match(/cada\s+(\d+)\s*h(?:oras?)?/);
  if (interval?.[1]) { const hours = Number(interval[1]); if ([8, 12, 24].includes(hours)) return hours === 24 ? ['Una toma al día · hora no indicada'] : [`Cada ${hours} horas · horario no indicado`]; }
  if (/una vez al d[ií]a|cada d[ií]a|c\s*\/\s*d/.test(normalized)) return ['Una toma al día · hora no indicada'];
  if (/ma[ñn]ana.*desayuno/i.test(normalized)) return ['Mañana con desayuno'];
  if (/almuerzo|mediod[ií]a/i.test(normalized)) return ['Almuerzo'];
  if (/noche|dormir/i.test(normalized)) return ['Noche antes de dormir'];
  return null;
}

function ErrorMessage({ message }: { message: string }) { return <p className="error-message" role="alert"><Icon name="alert" /> {message}</p>; }
function EmptyState({ title, message }: { title: string; message: string }) { return <div className="empty-state"><Icon name="image" /><strong>{title}</strong><span>{message}</span></div>; }
function formatAudioTime(value: number): string { if (!Number.isFinite(value) || value < 0) return '0:00'; return `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, '0')}`; }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function readPreference<T>(key: string, fallback: T): T { try { const stored = localStorage.getItem(key); return stored ? JSON.parse(stored) as T : fallback; } catch { return fallback; } }
function exampleImage(title: string, subtitle: string): string { return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420"><rect width="720" height="420" fill="#fffdf7"/><rect x="56" y="48" width="608" height="324" rx="18" fill="#ffffff" stroke="#cbd5e1" stroke-width="4"/><text x="92" y="116" font-family="sans-serif" font-size="28" font-weight="700" fill="#0f766e">FÓRMULA DE EJEMPLO</text><text x="92" y="184" font-family="sans-serif" font-size="28" fill="#334155">${title}</text><text x="92" y="232" font-family="sans-serif" font-size="24" fill="#64748b">${subtitle}</text><path d="M92 284h420M92 318h300" stroke="#cbd5e1" stroke-width="12" stroke-linecap="round"/></svg>`)}`; }

function LogoMark() { return <svg className="logo-mark" viewBox="0 0 48 48" aria-hidden="true"><path d="M6 25c5-12 10 12 15 0s10 12 15 0 6-5 6-5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" /><path d="M30 7v12M24 13h12" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" /></svg>; }
type IconName = 'alert' | 'arrow' | 'arrow-left' | 'camera' | 'check' | 'chevron-down' | 'chevron-up' | 'image' | 'lock' | 'moon' | 'pause' | 'pill' | 'play' | 'plus' | 'shield' | 'sun' | 'upload' | 'volume';
function Icon({ name }: { name: IconName }) { const paths: Record<IconName, string> = { alert: 'M12 3 2.8 20h18.4L12 3Zm0 6v5m0 3h.01', arrow: 'M4 12h15m-6-6 6 6-6 6', 'arrow-left': 'M20 12H5m6-6-6 6 6 6', camera: 'M4 8h3l2-2h6l2 2h3v11H4V8Zm8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z', check: 'm5 12 4 4L19 6', 'chevron-down': 'm6 9 6 6 6-6', 'chevron-up': 'm6 15 6-6 6 6', image: 'M4 5h16v14H4V5Zm2 11 3-3 2 2 3-4 4 5M8 9h.01', lock: 'M6 10h12v10H6V10Zm3 0V7a3 3 0 0 1 6 0v3', moon: 'M20 15a8 8 0 0 1-11-11 8 8 0 1 0 11 11Z', pause: 'M8 6v12m8-12v12', pill: 'M7 17 17 7m-8-3h6a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z', play: 'm8 5 11 7-11 7V5Z', plus: 'M12 5v14M5 12h14', shield: 'M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z', sun: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z', upload: 'M12 16V4m0 0L7 9m5-5 5 5M5 15v4h14v-4', volume: 'M5 10v4h3l4 3V7l-4 3H5Zm11-2a5 5 0 0 1 0 8m2-11a9 9 0 0 1 0 14' }; return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>; }

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
