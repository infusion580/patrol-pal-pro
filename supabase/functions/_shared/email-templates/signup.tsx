/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import {
  brandBar,
  brandName,
  brandTagline,
  button,
  container,
  footer,
  h1,
  hr,
  linkFallback,
  main,
  text,
} from './styles.ts'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Confirma tu cuenta en {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar} />
        <Text style={brandName}>Defender</Text>
        <Text style={brandTagline}>Seguridad Privada</Text>

        <Heading style={h1}>Confirma tu cuenta</Heading>
        <Text style={text}>
          Se creó una cuenta en {siteName} con el correo {recipient}. Confirma
          tu dirección para activar el acceso a la plataforma.
        </Text>

        <Button style={button} href={confirmationUrl}>
          Confirmar mi cuenta
        </Button>

        <Text style={linkFallback}>
          Si el botón no funciona, copia y pega esta dirección en tu navegador:
          <br />
          {confirmationUrl}
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          Si no reconoces este registro, ignora este mensaje.
        </Text>
        <Text style={footer}>
          Este es un correo automático de {siteName}. No respondas a este
          mensaje.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
