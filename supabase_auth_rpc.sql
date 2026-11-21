-- ============================================================
-- AEUDJ TRANSPORTE — FUNCIONES SQL SEGURAS (EJECUTAR EN SUPABASE SQL EDITOR)
-- 1. Permite iniciar sesión y recuperar contraseña usando matrícula, correo o teléfono.
-- 2. Permite al administrador eliminar cuentas completas (incluyendo auth.users).
-- 3. Permite al administrador cambiar la contraseña de cualquier usuario.
-- ============================================================

-- 1) Resolver email de login/recuperación sin exponer la tabla profiles públicamente
--    Consulta auth.users unido con profiles para garantizar el email real de Auth
CREATE OR REPLACE FUNCTION public.get_login_email(p_identifier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_clean text;
  v_email text;
BEGIN
  v_clean := regexp_replace(trim(coalesce(p_identifier, '')), '[\s-]+', '', 'g');
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(NULLIF(trim(u.email), ''), p.email)
    INTO v_email
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
   WHERE lower(trim(coalesce(p.email, ''))) = lower(trim(p_identifier))
      OR lower(trim(coalesce(u.email, ''))) = lower(trim(p_identifier))
      OR regexp_replace(trim(coalesce(p.matricula, '')), '[\s-]+', '', 'g') = v_clean
      OR regexp_replace(trim(coalesce(p.telefono, '')), '[\s-]+', '', 'g') = v_clean
   LIMIT 1;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_email(text) TO anon, authenticated;

-- 2) Permitir a administradores/desarrolladora eliminar usuarios completamente
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_rol text;
BEGIN
  SELECT rol INTO caller_rol FROM public.profiles WHERE id = auth.uid();
  IF caller_rol IS NULL OR (
    lower(caller_rol) NOT LIKE '%admin%' AND
    lower(caller_rol) NOT LIKE '%desarrolladora%'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  DELETE FROM public.penalidades WHERE usuario_id = target_user_id;
  DELETE FROM public.faltas WHERE usuario_id = target_user_id;
  DELETE FROM public.votos WHERE usuario_id = target_user_id;
  UPDATE public.puntos_log SET otorgado_por = NULL WHERE otorgado_por = target_user_id;
  DELETE FROM public.puntos_log WHERE voluntario_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- 3) Permitir a administradores/desarrolladora cambiar la contraseña de cualquier usuario
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id uuid, new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_rol text;
BEGIN
  SELECT rol INTO caller_rol FROM public.profiles WHERE id = auth.uid();
  IF caller_rol IS NULL OR (
    lower(caller_rol) NOT LIKE '%admin%' AND
    lower(caller_rol) NOT LIKE '%desarrolladora%'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF length(trim(coalesce(new_password, ''))) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;

  UPDATE auth.users
     SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
         updated_at = now()
   WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(uuid, text) TO authenticated;
