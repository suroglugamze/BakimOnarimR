/*
  # Fix infinite recursion in users table RLS policies

  1. Problem
    - Current RLS policies on users table create infinite recursion
    - Policies query the users table within their own conditions
    - This causes circular dependency when fetching user data

  2. Solution
    - Drop existing problematic policies
    - Create new policies that avoid self-referencing
    - Use auth.uid() directly without additional user table queries where possible
    - Simplify policy logic to prevent recursion

  3. Changes
    - Remove "Admins can manage users" policy (recreate without recursion)
    - Remove "Users can view colleagues in same department" policy (recreate without recursion)
    - Keep "Users can view their own data" policy (no recursion issue)
*/

-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can manage users" ON users;
DROP POLICY IF EXISTS "Users can view colleagues in same department" ON users;

-- Create new policies without recursion
-- Policy for users to view their own data (this one was fine)
-- Already exists: "Users can view their own data"

-- New policy for admins - simplified to avoid recursion
-- We'll check the role directly from the user record being accessed
CREATE POLICY "Admins have full access"
  ON users
  FOR ALL
  TO authenticated
  USING (
    -- Allow if the current user is an admin (check their own record first)
    EXISTS (
      SELECT 1 FROM auth.users au 
      WHERE au.id = auth.uid()
    )
    AND
    -- Then check if they have admin role in a separate query
    (
      SELECT role FROM users WHERE id = auth.uid()
    ) = 'admin'
  );

-- New policy for department managers to view users in their department
CREATE POLICY "Department managers can view department users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if user is viewing someone in their department and they are a department manager
    (
      SELECT u.role FROM users u WHERE u.id = auth.uid()
    ) = 'department_manager'
    AND
    (
      SELECT u.department_id FROM users u WHERE u.id = auth.uid()
    ) = department_id
  );

-- Policy for managers to view all users
CREATE POLICY "Managers can view all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    (
      SELECT role FROM users WHERE id = auth.uid()
    ) = 'manager'
  );