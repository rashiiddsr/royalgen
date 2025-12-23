/*
  # Fix User Profile Signup Policy

  ## Changes
  - Drop the restrictive admin-only insert policy
  - Add a new policy that allows users to create their own profile during signup
  - Users can only insert a profile where the id matches their auth.uid()
  
  ## Security
  - Users can only create one profile (their own)
  - The id must match their authenticated user id
  - After creation, only the user can update their own profile
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;

-- Allow users to insert their own profile during signup
CREATE POLICY "Users can create own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);