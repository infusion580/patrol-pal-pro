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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Te invitaron a unirte a {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar} />
        <Text style={brandName}>Defender</Text>
        <Text style={brandTagline}>Seguridad Privada</Text>

        <Heading style={h1}>Te invitaron a {siteName}</Heading>
        <Text style={text}>
          Tu empresa creó un acceso para ti en la plataforma de operación y
          supervisión {siteName}. Acepta la invitación para definir tu
          contraseña y comenzar.
        </Text>

        <Button style={button} href={confirmationUrl}>
          Aceptar invitación
        </Button>

        <Text style={linkFallback}>
          Si el botón no funciona, copia y pega esta dirección en tu navegador:
          <br />
          {confirmationUrl}
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          Si no esperabas esta invitación, puedes ignorar este mensaje.
        </Text>
        <Text style={footer}>
          Este es un correo automático de {siteName}. No respondas a este
          mensaje.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
