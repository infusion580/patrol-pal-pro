DO $$
DECLARE
    _uid uuid := gen_random_uuid();
    _email text := 'admin.demo@defender.app';
    _password text := 'Admin123!';
    _identity_id uuid := gen_random_uuid();
BEGIN
    -- Eliminar si ya existe
    DELETE FROM auth.identities WHERE identity_data->>'sub' = _uid::text;
    DELETE FROM auth.users WHERE email = _email;

    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
    ) VALUES (
        _uid, '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', _email, crypt(_password, gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}',
        '{"nombre":"Admin","apellido":"Demo","numero_empleado":"ADM001"}',
        now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
        provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
        _identity_id::text, _uid,
        json_build_object('sub', _uid::text, 'email', _email),
        'email', now(), now(), now()
    );

    -- El trigger handle_new_user ya creó el perfil y rol 'guardia'
    -- Sobreescribimos a admin
    DELETE FROM public.user_roles WHERE user_id = _uid;
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin');

    -- Asegurar que el perfil tenga datos correctos
    UPDATE public.profiles
       SET nombre = 'Admin', apellido = 'Demo', numero_empleado = 'ADM001', email = _email
     WHERE user_id = _uid;
END $$;