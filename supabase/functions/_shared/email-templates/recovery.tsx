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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Restablece tu contraseña de {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar} />
        <Text style={brandName}>Defender</Text>
        <Text style={brandTagline}>Seguridad Privada</Text>

        <Heading style={h1}>Restablece tu contraseña</Heading>
        <Text style={text}>
          Recibimos una solicitud para restablecer la contraseña de tu cuenta en{' '}
          {siteName}. Haz clic en el botón para crear una nueva contraseña.
          Este enlace es de un solo uso y caduca en 60 minutos.
        </Text>

        <Button style={button} href={confirmationUrl}>
          Crear nueva contraseña
        </Button>

        <Text style={linkFallback}>
          Si el botón no funciona, copia y pega esta dirección en tu navegador:
          <br />
          {confirmationUrl}
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          Si tú no solicitaste este cambio, ignora este mensaje: tu contraseña
          seguirá siendo la misma.
        </Text>
        <Text style={footer}>
          Este es un correo automático de {siteName}. No respondas a este
          mensaje.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
