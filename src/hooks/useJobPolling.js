import { useEffect, useRef, useState, useCallback } from 'react'
import { changeService } from '../services/changeService.js'

export function useJobPolling() {
  const [jobId, setJobId] = useState(null)
  const [status, setStatus] = useState('idle') // idle, pending, processing, done, failed, cancelled
  const [stage, setStage] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const timerRef = useRef(null)

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const cancel = useCallback(async () => {
    stopPolling()
    if (jobId) {
      try {
        await changeService.cancel(jobId)
      } catch {
        // Ignored
      }
    }
    setStatus('cancelled')
    setStage('Cancelled')
    setProgress(0)
  }, [jobId, stopPolling])

  const startJob = useCallback((id) => {
    stopPolling()
    setJobId(id)
    setStatus('processing')
    setStage('Fetching images')
    setProgress(5)
    setError(null)
    setResult(null)

    timerRef.current = setInterval(async () => {
      try {
        const j = await changeService.job(id)
        setStatus(j.status)
        setStage(j.stage || '')
        setProgress(j.progress || 0)

        if (j.status === 'done') {
          stopPolling()
          const res = await changeService.result(id)
          setResult(res)
        } else if (j.status === 'failed') {
          stopPolling()
          setError(j.error || 'Comparison failed')
        } else if (j.status === 'cancelled') {
          stopPolling()
        }
      } catch (err) {
        stopPolling()
        setStatus('failed')
        setError(err.message || 'Error checking job status')
      }
    }, 700)
  }, [stopPolling])

  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  const reset = useCallback(() => {
    stopPolling()
    setJobId(null)
    setStatus('idle')
    setStage('')
    setProgress(0)
    setError(null)
    setResult(null)
  }, [stopPolling])

  return {
    jobId,
    status,
    stage,
    progress,
    error,
    result,
    startJob,
    cancel,
    reset,
  }
}

