-- Update user role to admin
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'
)
WHERE email = 'fadlannafian@gmail.com';

-- Verify user roles
SELECT id, email, raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'fadlannafian@gmail.com';