<script setup>
import { useRouter } from "vue-router"
import { Card, Form, Input, Button, Typography, Alert, Space } from "ant-design-vue"
import { UserOutlined, LockOutlined } from "@ant-design/icons-vue"
import { useAuth } from "@/composables/useAuth"

const router = useRouter()
const { formState, error, loading, usernameRules, passwordRules, handleSignin } = useAuth()

// Handle form submit
async function onFinish() {
  await handleSignin()
}

// Navigate to signup
function goToSignup() {
  router.push("/signup")
}
</script>

<template>
  <div class="login-container">
    <Card style="width: 400px">
      <template #title>
        <Typography.Title :level="3" style="text-align: center; margin: 0">
          Sign In
        </Typography.Title>
      </template>

      <Alert v-if="error" :message="error" type="error" show-icon style="margin-bottom: 16px" />

      <Form :model="formState" layout="vertical" @finish="onFinish">
        <Form.Item name="username" :rules="usernameRules">
          <Input v-model:value="formState.username" placeholder="Username" size="large">
            <template #prefix>
              <UserOutlined />
            </template>
          </Input>
        </Form.Item>

        <Form.Item name="password" :rules="passwordRules">
          <Input.Password v-model:value="formState.password" placeholder="Password" size="large">
            <template #prefix>
              <LockOutlined />
            </template>
          </Input.Password>
        </Form.Item>

        <Form.Item>
          <Button type="primary" html-type="submit" size="large" block :loading="loading">
            Sign In
          </Button>
        </Form.Item>
      </Form>

      <Space style="width: 100%; justify-content: center">
        <Typography.Text>Don't have an account?</Typography.Text>
        <Typography.Link @click="goToSignup">Sign up</Typography.Link>
      </Space>
    </Card>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
}
</style>
