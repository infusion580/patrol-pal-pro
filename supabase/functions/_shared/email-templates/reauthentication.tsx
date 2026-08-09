/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
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
  codeBox,
  container,
  footer,
  h1,
  hr,
  main,
  text,
} from './styles.ts'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({
  token,
}: ReauthenticationEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu código de verificación: {token}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar} />
        <Text style={brandName}>Defender</Text>
        <Text style={brandTagline}>Seguridad Privada</Text>

        <Heading style={h1}>Código de verificación</Heading>
        <Text style={text}>
          Ingresa este código para confirmar la operación solicitada en tu
          cuenta:
        </Text>

        <Section style={codeBox}>{token}</Section>

        <Text style={text}>
          El código caduca en pocos minutos. Nunca lo compartas con nadie, ni
          siquiera con personal de soporte.
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          Si tú no solicitaste este código, ignora este mensaje y avisa a tu
          administrador.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
