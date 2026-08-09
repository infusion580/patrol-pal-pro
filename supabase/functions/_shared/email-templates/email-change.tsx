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
  infoBox,
  linkFallback,
  main,
  text,
} from './styles.ts'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Confirma el cambio de correo en {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar} />
        <Text style={brandName}>Defender</Text>
        <Text style={brandTagline}>Seguridad Privada</Text>

        <Heading style={h1}>Confirma tu nuevo correo</Heading>
        <Text style={text}>
          Se solicitó cambiar el correo de tu cuenta en {siteName}. Confirma el
          cambio para seguir recibiendo notificaciones y accesos.
        </Text>

        <Section style={infoBox}>
          Correo anterior: {oldEmail}
          <br />
          Correo nuevo: {newEmail}
        </Section>

        <Button style={button} href={confirmationUrl}>
          Confirmar cambio
        </Button>

        <Text style={linkFallback}>
          Si el botón no funciona, copia y pega esta dirección en tu navegador:
          <br />
          {confirmationUrl}
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          Si tú no solicitaste este cambio, contacta de inmediato a tu
          administrador.
        </Text>
        <Text style={footer}>
          Este es un correo automático de {siteName}. No respondas a este
          mensaje.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
