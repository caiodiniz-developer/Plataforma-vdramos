import { emailValido } from './email'

export const ASSUNTOS = ['consultoria', 'treinamento', 'palestra', 'outro'] as const
export type Assunto = (typeof ASSUNTOS)[number]

export const ROTULO_ASSUNTO: Record<Assunto, string> = {
  consultoria: 'Consultoria',
  treinamento: 'Treinamento',
  palestra: 'Palestra',
  outro: 'Outro',
}

export const CONTATO_MENSAGEM_MIN = 10
export const CONTATO_MENSAGEM_MAX = 2000

export type FormularioContato = {
  nome: string
  email: string
  assunto: Assunto | ''
  assunto_outro: string
  mensagem: string
  aceitou_privacidade: boolean
}

export type ErrosContato = Partial<Record<keyof FormularioContato, string>>

/** PRD F2 e seção 7: erro por campo; objeto vazio = pode enviar. */
export function validarContato(f: FormularioContato): ErrosContato {
  const erros: ErrosContato = {}
  const mensagem = f.mensagem.trim()

  if (f.nome.trim() === '') erros.nome = 'Informe seu nome.'
  if (f.email.trim() === '') erros.email = 'Informe seu e-mail.'
  else if (!emailValido(f.email)) erros.email = 'Confira o e-mail informado.'
  if (f.assunto === '') erros.assunto = 'Escolha um assunto.'
  if (f.assunto === 'outro' && f.assunto_outro.trim() === '') {
    erros.assunto_outro = 'Descreva o assunto.'
  }
  if (mensagem.length < CONTATO_MENSAGEM_MIN) {
    erros.mensagem = `Escreva ao menos ${CONTATO_MENSAGEM_MIN} caracteres.`
  } else if (mensagem.length > CONTATO_MENSAGEM_MAX) {
    erros.mensagem = `A mensagem passa de ${CONTATO_MENSAGEM_MAX} caracteres.`
  }
  if (!f.aceitou_privacidade) {
    erros.aceitou_privacidade = 'Confirme a leitura da política de privacidade.'
  }
  return erros
}
