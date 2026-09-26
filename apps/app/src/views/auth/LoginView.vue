<script setup lang="ts">
import { useRouter } from "vue-router"
import { useForm } from "vee-validate"
import { toTypedSchema } from "@vee-validate/zod"
import { Lock, Mail } from "@lucide/vue"
import { useAuth } from "@/composables/useAuth"
import { loginSchema } from "@/schemas/auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

const router = useRouter()
const { formState, error, loading, handleSignin } = useAuth()

const form = useForm({
  validationSchema: toTypedSchema(loginSchema),
  initialValues: { email: "", password: "" },
})

// Copy the validated values into `formState`, so `useAuth` and the store stay unchanged.
const onSubmit = form.handleSubmit(async (values) => {
  formState.email = values.email
  formState.password = values.password
  await handleSignin()
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-muted p-4">
    <Card class="w-full max-w-[400px]">
      <CardHeader><CardTitle class="text-center text-2xl">Sign In</CardTitle></CardHeader>
      <CardContent>
        <Alert v-if="error" variant="destructive" class="mb-4">
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>
        <form class="space-y-4" novalidate @submit="onSubmit">
          <FormField v-slot="{ componentField }" name="email">
            <FormItem>
              <FormControl>
                <div class="relative">
                  <Mail class="absolute top-3 left-2.5 size-4 text-muted-foreground" />
                  <Input v-bind="componentField" type="email" placeholder="Email" class="pl-8" />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField v-slot="{ componentField }" name="password">
            <FormItem>
              <FormControl>
                <div class="relative">
                  <Lock class="absolute top-3 left-2.5 size-4 text-muted-foreground" />
                  <Input
                    v-bind="componentField"
                    type="password"
                    placeholder="Password"
                    class="pl-8"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <Button type="submit" class="w-full" :disabled="loading">
            <Spinner v-if="loading" />
            Sign In
          </Button>
        </form>
        <p class="mt-4 text-center text-sm text-muted-foreground">
          Don't have an account?
          <Button variant="link" class="h-auto p-0" @click="router.push('/signup')">Sign up</Button>
        </p>
      </CardContent>
    </Card>
  </div>
</template>
