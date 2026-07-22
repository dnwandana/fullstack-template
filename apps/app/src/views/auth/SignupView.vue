<script setup>
import { useRouter } from "vue-router"
import { Card, Form, Input, Button, Typography, Alert, Space } from "ant-design-vue"
import { UserOutlined, MailOutlined, LockOutlined } from "@ant-design/icons-vue"
import { useAuth } from "@/composables/useAuth"

const router = useRouter()
const {
  formState,
  error,
  loading,
  nameRules,
  emailRules,
  passwordRules,
  confirmation_passwordRules,
  handleSignup,
} = useAuth()

// Handle form submit
async function onFinish() {
  await handleSignup()
}

// Navigate to login
function goToLogin() {
  router.push("/login")
}
</script>

<template>
  <div class="signup-container">
    <Card style="width: 400px">
      <template #title>
        <Typography.Title :level="3" style="text-align: center; margin: 0">
          Create Account
        </Typography.Title>
      </template>

      <Alert v-if="error" :message="error" type="error" show-icon style="margin-bottom: 16px" />

      <Form :model="formState" layout="vertical" @finish="onFinish">
        <Form.Item name="name" :rules="nameRules">
          <Input v-model:value="formState.name" placeholder="Full name" size="large">
            <template #prefix>
              <UserOutlined />
            </template>
          </Input>
        </Form.Item>

        <Form.Item name="email" :rules="emailRules">
          <Input v-model:value="formState.email" placeholder="Email" size="large">
            <template #prefix>
              <MailOutlined />
            </template>
          </Input>
        </Form.Item>

        <Form.Item name="password" :rules="passwordRules">
          <Input.Password
            v-model:value="formState.password"
            placeholder="Password (min 8 characters)"
            size="large"
          >
            <template #prefix>
              <LockOutlined />
            </template>
          </Input.Password>
        </Form.Item>

        <Form.Item name="confirmation_password" :rules="confirmation_passwordRules">
          <Input.Password
            v-model:value="formState.confirmation_password"
            placeholder="Confirm Password"
            size="large"
          >
            <template #prefix>
              <LockOutlined />
            </template>
          </Input.Password>
        </Form.Item>

        <Form.Item>
          <Button type="primary" html-type="submit" size="large" block :loading="loading">
            Sign Up
          </Button>
        </Form.Item>
      </Form>

      <Space style="width: 100%; justify-content: center">
        <Typography.Text>Already have an account?</Typography.Text>
        <Typography.Link @click="goToLogin">Sign in</Typography.Link>
      </Space>
    </Card>
  </div>
</template>

<style scoped>
.signup-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
}
</style>
