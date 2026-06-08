import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userRole: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile) {
      userRole = profile.role
    }
  }

  const isLoginPage = request.nextUrl.pathname.startsWith('/login')
  const isAdminPage = request.nextUrl.pathname.startsWith('/admin')
  const isEmployeePage = request.nextUrl.pathname.startsWith('/funcionario')

  // Redireciona admins ou bloqueia acesso de quem não está logado na área admin
  if (isAdminPage) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    } else if (userRole === 'employee') {
      // Funcionários não podem acessar a aba admin, vão pro checklist
      const url = request.nextUrl.clone()
      url.pathname = '/funcionario/checklist'
      return NextResponse.redirect(url)
    }
  }

  // Redireciona para login se tentar acessar /funcionario deslogado
  if (isEmployeePage) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  // Ao acessar /login, se já logado, redireciona para a página correta
  if (isLoginPage && user) {
    const url = request.nextUrl.clone()
    if (userRole === 'employee') {
      url.pathname = '/funcionario/checklist'
    } else {
      url.pathname = '/admin'
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
