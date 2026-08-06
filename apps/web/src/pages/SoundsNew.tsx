import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { ArrowLeft, Upload, Check, AlertCircle } from 'lucide-react';

export const SoundsNew: React.FC = () => {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [commandName, setCommandName] = useState('');
  const [description, setDescription] = useState('');
  const [volume, setVolume] = useState(1.0);
  const [file, setFile] = useState<File | null>(null);

  // Validaciones y estados
  const [commandAvailable, setCommandAvailable] = useState<boolean | null>(null);
  const [checkingCommand, setCheckingCommand] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validar disponibilidad de comando en tiempo real (debounced)
  useEffect(() => {
    if (!commandName) {
      setCommandAvailable(null);
      return;
    }

    // Regla de sintaxis básica antes de consultar
    const normalized = commandName.trim().toLowerCase();
    if (normalized.length < 2 || normalized.length > 64 || !/^[a-z0-9\-_]+$/.test(normalized)) {
      setCommandAvailable(false);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingCommand(true);
      try {
        const res = await apiRequest(`/api/sounds/commands/check?name=${normalized}`);
        setCommandAvailable(res.available);
      } catch {
        setCommandAvailable(false);
      } finally {
        setCheckingCommand(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [commandName]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validar tamaño en cliente (ej: 20MB)
      const maxSizeBytes = 20 * 1024 * 1024;
      if (selectedFile.size > maxSizeBytes) {
        setError('El archivo excede el tamaño máximo permitido de 20 MB.');
        setFile(null);
        return;
      }

      setError(null);
      setFile(selectedFile);
      
      // Auto-rellenar nombre visible si está vacío
      if (!displayName) {
        const baseName = selectedFile.name.replace(/\.[^/.]+$/, "");
        setDisplayName(baseName);
      }

      // Auto-rellenar comando si está vacío
      if (!commandName) {
        const baseName = selectedFile.name.replace(/\.[^/.]+$/, "");
        const safeCommand = baseName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\-_]/g, '-')
          .substring(0, 30);
        setCommandName(safeCommand);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !displayName || !commandName || commandAvailable === false) {
      setError('Por favor completa todos los campos correctamente.');
      return;
    }

    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('displayName', displayName);
    formData.append('commandName', commandName.trim().toLowerCase());
    formData.append('description', description);
    formData.append('volume', volume.toString());

    // Usar XMLHttpRequest para poder monitorizar el progreso de subida
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/sounds`);
    xhr.withCredentials = true; // Para enviar cookies de sesión

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded * 100) / event.total);
        setUploadProgress(percentage);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadProgress(100);
        setTimeout(() => {
          navigate('/sounds');
        }, 800);
      } else {
        setUploadProgress(null);
        try {
          const res = JSON.parse(xhr.responseText);
          setError(res.error?.message || 'Error al subir el sonido.');
        } catch {
          setError('Error de procesamiento del audio. Asegúrate de que el archivo no está corrupto.');
        }
      }
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      setError('Error de red al intentar conectarse al servidor.');
    };

    xhr.send(formData);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/sounds')}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-semibold"
      >
        <ArrowLeft size={16} />
        Volver a la lista
      </button>

      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white">Subir Nuevo Sonido</h2>
        <p className="text-slate-400 text-sm mt-1">Sube archivos MP3, WAV, OGG, WEBM o M4A. Se convertirán automáticamente a Ogg Opus.</p>
      </div>

      {/* Form Container */}
      <div className="bg-darkcard border border-darkborder p-6 rounded-2xl shadow-xl shadow-black/25">
        {error && (
          <div className="mb-6 p-4 bg-accentred/15 border border-accentred/35 text-slate-200 text-sm rounded-xl flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* File Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Archivo de Audio
            </label>
            <div className="border-2 border-dashed border-darkborder hover:border-primary/50 rounded-2xl p-8 flex flex-col items-center justify-center transition-all bg-darkbg/35 relative">
              <input
                type="file"
                onChange={handleFileChange}
                accept="audio/*"
                required
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload size={32} className="text-slate-500 mb-3" />
              <span className="text-sm font-semibold text-white">
                {file ? file.name : 'Selecciona o arrastra tu archivo'}
              </span>
              <span className="text-xs text-slate-500 mt-1">
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Formatos: MP3, WAV, OGG, FLAC, M4A (Máx. 20MB / 60s)'}
              </span>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Nombre Visible
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
              placeholder="Ej: Risa Malvada"
            />
          </div>

          {/* Command Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              Nombre del Comando
              <span className="text-[10px] text-slate-500 normal-case">Sin espacios ni barras, ej: risa-malvada</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={commandName}
                onChange={(e) => setCommandName(e.target.value.replace(/\s+/g, '-'))}
                required
                className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all font-mono"
                placeholder="risa-malvada"
              />
              <div className="absolute right-4 top-3 flex items-center gap-1">
                {checkingCommand && (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                )}
                {!checkingCommand && commandAvailable === true && (
                  <span className="text-[10px] text-green-500 font-semibold flex items-center gap-0.5">
                    <Check size={12} /> Disponible
                  </span>
                )}
                {!checkingCommand && commandAvailable === false && (
                  <span className="text-[10px] text-accentred font-semibold flex items-center gap-0.5">
                    <AlertCircle size={12} /> No disponible o inválido
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Descripción (Opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-darkbg border border-darkborder focus:border-primary rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all resize-none"
              placeholder="Descripción del sonido..."
            />
          </div>

          {/* Volume Slider */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              Multiplicador de Volumen
              <span className="text-sm font-semibold text-white">{volume.toFixed(2)}x</span>
            </label>
            <input
              type="range"
              min="0.0"
              max="2.0"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-darkbg border border-darkborder rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1.5">
              <span>Silenciado (0.0x)</span>
              <span>Normal (1.0x)</span>
              <span>Doble (2.0x)</span>
            </div>
          </div>

          {/* Upload Progress Bar */}
          {uploadProgress !== null && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400 font-semibold">
                <span>{uploadProgress === 100 ? 'Procesando y normalizando audio...' : 'Subiendo archivo...'}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-darkbg h-2 rounded-full overflow-hidden border border-darkborder">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-darkborder pt-6">
            <button
              type="button"
              onClick={() => navigate('/sounds')}
              className="px-5 py-2.5 bg-darkbg hover:bg-darkborder border border-darkborder text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!file || !displayName || !commandName || commandAvailable === false || uploadProgress !== null}
              className="px-5 py-2.5 bg-primary hover:bg-primaryhover disabled:opacity-40 text-white rounded-xl text-sm font-semibold shadow-lg shadow-primary/10 transition-all"
            >
              Comenzar Subida
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
