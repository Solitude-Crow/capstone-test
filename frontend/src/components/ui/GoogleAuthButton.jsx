// src/components/ui/GoogleAuthButton.jsx
// "Continue with Google" — renders Google's official button, verifies the
// credential server-side, then either logs in or routes to Complete Registration.
import { GoogleLogin } from '@react-oauth/google'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

const ROLE_HOME = {
  counselor: '/counselor/dashboard',
  faculty:   '/faculty/dashboard',
  student:   '/student/dashboard',
}

export default function GoogleAuthButton() {
  const navigate = useNavigate()
  const googleLogin = useAuthStore((s) => s.googleLogin)

  const handleSuccess = async (resp) => {
    if (!resp?.credential) return toast.error('Google sign-in failed. Please try again.')
    try {
      const res = await googleLogin(resp.credential)
      if (res.needsRegistration) {
        navigate('/complete-registration')
      } else {
        toast.success(`Welcome, ${res.user.fullName}!`)
        navigate(ROLE_HOME[res.user.role] ?? '/student/dashboard')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Google sign-in failed')
    }
  }

  return (
    <div className="flex justify-center">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => toast.error('Google sign-in was cancelled or failed')}
        text="continue_with"
        shape="rectangular"
        width="320"
      />
    </div>
  )
}
