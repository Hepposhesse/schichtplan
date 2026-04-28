import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://fxvicaazpcyfzkxtriau.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4dmljYWF6cGN5ZnpreHRyaWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNjQ5NjcsImV4cCI6MjA5Mjg0MDk2N30.yIMSd-z1FFmWSEdLlsF_G4-PA8PHGESH0gQhod03BTg'
)