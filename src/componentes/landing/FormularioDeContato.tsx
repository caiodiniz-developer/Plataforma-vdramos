import { Loader2Icon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { enviarContato } from '@/dados/landing'
import {
  ASSUNTOS,
  CONTATO_MENSAGEM_MAX,
  ROTULO_ASSUNTO,
  validarContato,
  type Assunto,
  type ErrosContato,
  type FormularioContato,
} from '@/dominio/contato'

const VAZIO: FormularioContato = {
  nome: '',
  email: '',
  assunto: '',
  assunto_outro: '',
  mensagem: '',
  aceitou_privacidade: false,
}

function Erro({ id, mensagem }: { id: string; mensagem?: string }) {
  if (!mensagem) return null
  return (
    <p id={id} role="alert" className="text-[13px] font-bold text-destructive">
      {mensagem}
    </p>
  )
}

/** PRD F2: formulário de contato com validação por campo e reenvio em falha. */
export function FormularioDeContato() {
  const id = useId()
  const [formulario, setFormulario] = useState<FormularioContato>(VAZIO)
  const [erros, setErros] = useState<ErrosContato>({})
  const [enviando, setEnviando] = useState(false)

  function alterar<C extends keyof FormularioContato>(campo: C, valor: FormularioContato[C]) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }))
    setErros((atuais) => ({ ...atuais, [campo]: undefined }))
  }

  async function enviar() {
    setEnviando(true)
    try {
      await enviarContato(formulario)
      // Só limpa o formulário depois da confirmação do servidor.
      setFormulario(VAZIO)
      toast.success('Mensagem enviada', { description: 'Você recebe a resposta no e-mail informado.' })
    } catch (falha) {
      toast.error((falha as Error).message, {
        action: { label: 'Tentar de novo', onClick: () => void enviar() },
      })
    } finally {
      setEnviando(false)
    }
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    const encontrados = validarContato(formulario)
    setErros(encontrados)
    if (Object.keys(encontrados).length === 0) void enviar()
  }

  const campo = (nome: keyof FormularioContato) => ({
    id: `${id}-${nome}`,
    'aria-invalid': erros[nome] ? true : undefined,
    'aria-describedby': erros[nome] ? `${id}-${nome}-erro` : undefined,
  })

  return (
    <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-nome`}>Nome</Label>
          <Input
            {...campo('nome')}
            autoComplete="name"
            value={formulario.nome}
            onChange={(e) => alterar('nome', e.target.value)}
          />
          <Erro id={`${id}-nome-erro`} mensagem={erros.nome} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-email`}>E-mail</Label>
          <Input
            {...campo('email')}
            type="email"
            autoComplete="email"
            value={formulario.email}
            onChange={(e) => alterar('email', e.target.value)}
          />
          <Erro id={`${id}-email-erro`} mensagem={erros.email} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-assunto`}>Assunto</Label>
        <Select value={formulario.assunto} onValueChange={(valor) => alterar('assunto', valor as Assunto)}>
          <SelectTrigger {...campo('assunto')}>
            <SelectValue placeholder="Escolha um assunto" />
          </SelectTrigger>
          <SelectContent>
            {ASSUNTOS.map((assunto) => (
              <SelectItem key={assunto} value={assunto}>
                {ROTULO_ASSUNTO[assunto]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Erro id={`${id}-assunto-erro`} mensagem={erros.assunto} />
      </div>

      {formulario.assunto === 'outro' && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-assunto_outro`}>Qual assunto?</Label>
          <Input
            {...campo('assunto_outro')}
            value={formulario.assunto_outro}
            onChange={(e) => alterar('assunto_outro', e.target.value)}
          />
          <Erro id={`${id}-assunto_outro-erro`} mensagem={erros.assunto_outro} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-mensagem`}>Mensagem</Label>
        <Textarea
          {...campo('mensagem')}
          rows={6}
          maxLength={CONTATO_MENSAGEM_MAX}
          value={formulario.mensagem}
          onChange={(e) => alterar('mensagem', e.target.value)}
        />
        <div className="flex justify-between gap-4">
          <Erro id={`${id}-mensagem-erro`} mensagem={erros.mensagem} />
          <p className="ml-auto text-xs text-muted-foreground">
            {formulario.mensagem.length}/{CONTATO_MENSAGEM_MAX}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <Checkbox
            {...campo('aceitou_privacidade')}
            checked={formulario.aceitou_privacidade}
            onCheckedChange={(marcado) => alterar('aceitou_privacidade', marcado === true)}
          />
          <Label htmlFor={`${id}-aceitou_privacidade`} className="leading-snug font-medium">
            <span>
              Li a{' '}
              <Link to="/privacidade" className="font-bold underline">
                política de privacidade
              </Link>
              .
            </span>
          </Label>
        </div>
        <Erro id={`${id}-aceitou_privacidade-erro`} mensagem={erros.aceitou_privacidade} />
      </div>

      <Button type="submit" disabled={enviando} className="self-start">
        {enviando && <Loader2Icon className="animate-spin" aria-hidden="true" />}
        {enviando ? 'Enviando' : 'Enviar mensagem'}
      </Button>
    </form>
  )
}
