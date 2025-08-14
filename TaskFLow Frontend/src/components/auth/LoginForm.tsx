// src/components/auth/LoginForm.tsx - Enhanced with comprehensive debugging
import React, { useState } from 'react';
import { Eye, EyeOff, CheckSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../common/Button';
import { useNavigate } from 'react-router-dom';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const { login, companyLogin } = useAuth();
  const navigate = useNavigate();

  const addDebugInfo = (message: string) => {
    console.log(message);
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDebugInfo([]); // Clear previous debug info

    addDebugInfo(`[FORM] Login form submitted with email/username: ${email}`);

    try {
      // Try regular login first
      addDebugInfo('[FORM] Attempting regular login...');
      const regularResult = await login(email, password);
      addDebugInfo(`[FORM] Regular login result: ${JSON.stringify(regularResult)}`);

      if (regularResult.success) {
        addDebugInfo('[FORM] Regular login successful, navigating to dashboard');
        navigate('/dashboard');
        return;
      }

      // If regular login fails, try company login
      addDebugInfo('[FORM] Regular login failed, attempting company login...');
      const companyResult = await companyLogin(email, password);
      addDebugInfo(`[FORM] Company login result: ${JSON.stringify(companyResult)}`);

      if (companyResult.success) {
        addDebugInfo('[FORM] Company login successful, navigating to dashboard');
        navigate('/dashboard');
        return;
      }

      // Both failed
      addDebugInfo('[FORM] Both login attempts failed');
      const errorMsg = companyResult.error || regularResult.error || 'Login failed. Please check your credentials.';
      setError(errorMsg);
      addDebugInfo(`[FORM] Final error message: ${errorMsg}`);

    } catch (err: any) {
      addDebugInfo(`[FORM] Unexpected error during login: ${err.message}`);
      console.error('[FORM] Unexpected error during login:', err);
      setError('An unexpected error occurred during login.');
    } finally {
      addDebugInfo('[FORM] Login process completed, setting loading to false');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
              <CheckSquare className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Welcome to TaskFlow</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account to manage tasks and teams
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="bg-white p-8 rounded-2xl shadow-lg backdrop-blur-sm bg-opacity-95">
            <div className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email / Company Username
                </label>
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email or company username"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-red-600 text-sm p-3 border border-red-300 rounded-lg bg-red-50">
                  {error}
                </div>
              )}

              {/* Debug Information (remove in production) */}
              {debugInfo.length > 0 && (
                <div className="text-xs text-gray-500 p-3 border border-gray-200 rounded-lg bg-gray-50 max-h-32 overflow-y-auto">
                  <div className="font-semibold mb-1">Debug Info:</div>
                  {debugInfo.map((info, index) => (
                    <div key={index} className="mb-1">{info}</div>
                  ))}
                </div>
              )}

              <Button
                type="submit"
                loading={loading}
                className="w-full py-3"
              >
                Sign In
              </Button>
            </div>
          </div>
        </form>

        <div className="text-center text-sm text-gray-500">
          <p>Demo Credentials:</p>
          <p><strong>Admin:</strong> admin@company.com / password</p>
          <p><strong>User:</strong> user@company.com / password</p>
          <p className="mt-2"><strong>Company Admin Login:</strong> Use the company username and password.</p>
          <p className="mt-1 text-xs">Try: <strong>vivo / [company_password]</strong></p>
        </div>
      </div>
    </div>
  );
};


// src/components/auth/LoginForm.tsx
// import React, { useState } from 'react';
// import { Eye, EyeOff, CheckSquare } from 'lucide-react';
// import { useAuth } from '../../contexts/AuthContext';
// import { Button } from '../common/Button';
// import { useNavigate } from 'react-router-dom';

// export const LoginForm: React.FC = () => {
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [debugInfo, setDebugInfo] = useState<string[]>([]);

//   const { login } = useAuth(); // Only using login now
//   const navigate = useNavigate();

//   const addDebugInfo = (message: string) => {
//     console.log(message);
//     setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setError(null);
//     setDebugInfo([]); // Clear debug info

//     addDebugInfo(`[FORM] Login form submitted with username/email: ${email}`);

//     try {
//       // Single unified login call
//       const result = await login(email, password);
//       addDebugInfo(`[FORM] Login result: ${JSON.stringify(result)}`);

//       if (result?.access_token && result?.user) {
//         addDebugInfo('[FORM] Login successful, navigating to dashboard');
//         navigate('/dashboard');
//       } else {
//         const errorMsg = result?.error || 'Login failed. Please check your credentials.';
//         setError(errorMsg);
//         addDebugInfo(`[FORM] Error: ${errorMsg}`);
//       }
//     } catch (err: any) {
//       addDebugInfo(`[FORM] Unexpected error during login: ${err.message}`);
//       console.error('[FORM] Unexpected error during login:', err);
//       setError('An unexpected error occurred during login.');
//     } finally {
//       addDebugInfo('[FORM] Login process completed');
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4">
//       <div className="max-w-md w-full space-y-8">
//         <div className="text-center">
//           <div className="flex justify-center mb-4">
//             <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
//               <CheckSquare className="w-8 h-8 text-white" />
//             </div>
//           </div>
//           <h2 className="text-3xl font-bold text-gray-900">Welcome to TaskFlow</h2>
//           <p className="mt-2 text-sm text-gray-600">
//             Sign in to your account to manage tasks and teams
//           </p>
//         </div>

//         <form onSubmit={handleSubmit} className="mt-8 space-y-6">
//           <div className="bg-white p-8 rounded-2xl shadow-lg backdrop-blur-sm bg-opacity-95">
//             <div className="space-y-6">
//               {/* Email/Company Username */}
//               <div>
//                 <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
//                   Email / Company Username
//                 </label>
//                 <input
//                   id="email"
//                   type="text"
//                   value={email}
//                   onChange={(e) => setEmail(e.target.value)}
//                   className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                   placeholder="Enter your email or company username"
//                   required
//                 />
//               </div>

//               {/* Password */}
//               <div>
//                 <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
//                   Password
//                 </label>
//                 <div className="relative">
//                   <input
//                     id="password"
//                     type={showPassword ? 'text' : 'password'}
//                     value={password}
//                     onChange={(e) => setPassword(e.target.value)}
//                     className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
//                     placeholder="Enter your password"
//                     required
//                   />
//                   <button
//                     type="button"
//                     onClick={() => setShowPassword(!showPassword)}
//                     className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
//                   >
//                     {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
//                   </button>
//                 </div>
//               </div>

//               {/* Error Message */}
//               {error && (
//                 <div className="text-red-600 text-sm p-3 border border-red-300 rounded-lg bg-red-50">
//                   {error}
//                 </div>
//               )}

//               {/* Debug Info */}
//               {debugInfo.length > 0 && (
//                 <div className="text-xs text-gray-500 p-3 border border-gray-200 rounded-lg bg-gray-50 max-h-32 overflow-y-auto">
//                   <div className="font-semibold mb-1">Debug Info:</div>
//                   {debugInfo.map((info, index) => (
//                     <div key={index} className="mb-1">{info}</div>
//                   ))}
//                 </div>
//               )}

//               {/* Submit Button */}
//               <Button
//                 type="submit"
//                 loading={loading}
//                 className="w-full py-3"
//               >
//                 Sign In
//               </Button>
//             </div>
//           </div>
//         </form>

//         {/* Demo credentials */}
//         <div className="text-center text-sm text-gray-500">
//           <p>Demo Credentials:</p>
//           <p><strong>Admin:</strong> admin@company.com / password</p>
//           <p><strong>User:</strong> user@company.com / password</p>
//           <p className="mt-2"><strong>Company Admin Login:</strong> Use the company username and password.</p>
//           <p className="mt-1 text-xs">Try: <strong>vivo / [company_password]</strong></p>
//         </div>
//       </div>
//     </div>
//   );
// };
