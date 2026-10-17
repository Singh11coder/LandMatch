import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, X, CheckCircle2, AlertCircle, FileImage, Loader2 } from 'lucide-react'
import { cx } from '../common/index.jsx'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_PHOTOS = 5

export function PhotoUpload({ existingPhotos = [], onPhotosChange, disabled = false }) {
  const [files, setFiles] = useState([]) // [{ id, file, url, progress, status, error }]
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)
  const activeUrlsRef = useRef(new Set())

  // Revoke created object URLs on unmount
  useEffect(() => {
    const urls = activeUrlsRef.current
    return () => {
      urls.forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [])

  const handleFiles = useCallback((incomingFiles) => {
    const totalCurrent = existingPhotos.length + files.length
    if (totalCurrent >= MAX_PHOTOS) {
      alert(`Maximum of ${MAX_PHOTOS} photos allowed per inspection.`)
      return
    }

    const availableSlots = MAX_PHOTOS - totalCurrent
    const toProcess = Array.from(incomingFiles).slice(0, availableSlots)

    const newEntries = toProcess.map((file) => {
      // Validate type
      if (!file.type.startsWith('image/')) {
        return {
          id: `err-${Date.now()}-${Math.random()}`,
          name: file.name,
          status: 'error',
          error: 'Only image files are accepted (JPG, PNG, WebP).',
        }
      }
      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        return {
          id: `err-${Date.now()}-${Math.random()}`,
          name: file.name,
          status: 'error',
          error: 'File exceeds maximum size of 5 MB.',
        }
      }

      const url = URL.createObjectURL(file)
      activeUrlsRef.current.add(url)

      return {
        id: `photo-${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        size: (file.size / 1024).toFixed(0) + ' KB',
        url,
        progress: 0,
        status: 'uploading', // uploading -> done
        error: null,
      }
    })

    setFiles((prev) => [...prev, ...newEntries])

    // Simulate upload progress for valid entries
    newEntries.forEach((entry) => {
      if (entry.status !== 'uploading') return

      let current = 0
      const interval = setInterval(() => {
        current += 20 + Math.random() * 25
        if (current >= 100) {
          clearInterval(interval)
          setFiles((prev) =>
            prev.map((item) =>
              item.id === entry.id ? { ...item, progress: 100, status: 'done' } : item
            )
          )
          // Notify parent of added photo
          if (onPhotosChange) {
            onPhotosChange(entry.url)
          }
        } else {
          setFiles((prev) =>
            prev.map((item) =>
              item.id === entry.id ? { ...item, progress: Math.min(95, Math.round(current)) } : item
            )
          )
        }
      }, 150)
    })
  }, [existingPhotos.length, files.length, onPhotosChange])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const removeFile = (id) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id)
      if (target?.url && target.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url)
        activeUrlsRef.current.delete(target.url)
      }
      return prev.filter((f) => f.id !== id)
    })
  }

  const remainingSlots = MAX_PHOTOS - (existingPhotos.length + files.length)

  return (
    <div className="space-y-3">
      {/* Existing uploaded photos preview */}
      {existingPhotos.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted mb-2">Inspection Evidence ({existingPhotos.length}/{MAX_PHOTOS})</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {existingPhotos.map((photoUrl, idx) => (
              <div key={idx} className="group relative aspect-video overflow-hidden rounded-xl border border-line bg-base">
                <img src={photoUrl} alt={`Evidence ${idx + 1}`} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-[10px] font-semibold text-white">Photo #{idx + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Dropzone */}
      {!disabled && remainingSlots > 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          role="region"
          aria-label="Field photo upload dropzone"
          className={cx(
            'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-colors cursor-pointer',
            dragOver ? 'border-accent bg-accent/10' : 'border-line bg-base hover:border-line/80 hover:bg-surface/50'
          )}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
          tabIndex={0}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files)
            }}
          />
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent mb-2">
            <Upload size={18} />
          </div>
          <p className="text-xs font-semibold text-ink">
            Drag & drop field photos, or <span className="text-accent underline">browse</span>
          </p>
          <p className="text-[11px] text-muted mt-1">
            Max 5 MB per image · Up to {remainingSlots} more {remainingSlots === 1 ? 'photo' : 'photos'}
          </p>
        </div>
      )}

      {/* Uploading & Staged Previews */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((item) => (
            <div
              key={item.id}
              className={cx(
                'flex items-center gap-3 rounded-xl border p-2.5 text-xs',
                item.status === 'error'
                  ? 'border-critical/40 bg-critical/10 text-critical'
                  : 'border-line bg-surface text-ink'
              )}
            >
              {item.url ? (
                <img src={item.url} alt={item.name} className="h-10 w-10 shrink-0 rounded-lg object-cover border border-line" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-base text-muted">
                  <FileImage size={18} />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="truncate font-medium">{item.name}</p>
                  {item.status === 'done' && <CheckCircle2 size={14} className="text-resolved shrink-0 ml-1" />}
                  {item.status === 'uploading' && <Loader2 size={14} className="text-accent animate-spin shrink-0 ml-1" />}
                  {item.status === 'error' && <AlertCircle size={14} className="text-critical shrink-0 ml-1" />}
                </div>

                {item.status === 'uploading' && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-base">
                      <div className="h-full bg-accent transition-all duration-200" style={{ width: `${item.progress}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-muted">{item.progress}%</span>
                  </div>
                )}

                {item.status === 'done' && (
                  <p className="text-[11px] text-muted mt-0.5">{item.size} · Uploaded successfully</p>
                )}

                {item.status === 'error' && (
                  <p className="text-[11px] text-critical mt-0.5">{item.error}</p>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(item.id) }}
                aria-label={`Remove ${item.name}`}
                className="rounded-lg p-1 text-muted hover:text-ink hover:bg-line transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

