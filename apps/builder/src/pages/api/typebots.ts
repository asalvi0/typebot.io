import { Plan } from '@typebot.io/prisma'
import prisma from '@/lib/prisma'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  badRequest,
  methodNotAllowed,
  notAuthenticated,
  notFound,
} from '@typebot.io/lib/api'
import { getAuthenticatedUser } from '@/features/auth/helpers/getAuthenticatedUser'
import {
  NewTypebotProps,
  parseNewTypebot,
} from '@/features/dashboard/api/parseNewTypebot'
import { omit } from '@typebot.io/lib'
import { sendTelemetryEvents } from '@typebot.io/lib/telemetry/sendTelemetryEvent'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return notAuthenticated(res)
  try {
    if (req.method === 'GET') {
      const workspaceId = req.query.workspaceId as string | undefined
      if (!workspaceId) return badRequest(res)
      const typebotIds = req.query.typebotIds as string[]
      const typebots = await prisma.typebot.findMany({
        where: {
          OR: [
            {
              workspace: { members: { some: { userId: user.id } } },
              id: { in: typebotIds },
              isArchived: { not: true },
            },
            {
              id: { in: typebotIds },
              collaborators: {
                some: {
                  userId: user.id,
                },
              },
              isArchived: { not: true },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { name: true, id: true, groups: true, variables: true },
      })
      return res.send({ typebots })
    }
    if (req.method === 'POST') {
      const workspace = await prisma.workspace.findFirst({
        where: { id: req.body.workspaceId },
        select: { plan: true },
      })
      if (!workspace) return notFound(res, "Couldn't find workspace")
      const data =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const formattedData = removeOldProperties(data) as
        | NewTypebotProps
        | Omit<NewTypebotProps, 'groups'>
      const typebot = await prisma.typebot.create({
        data:
          'groups' in formattedData
            ? formattedData
            : parseNewTypebot({
                ownerAvatarUrl: user.image ?? undefined,
                isBrandingEnabled: workspace.plan === Plan.FREE,
                ...data,
              }),
      })
      await sendTelemetryEvents([
        {
          name: 'Typebot created',
          userId: user.id,
          workspaceId: typebot.workspaceId,
          typebotId: typebot.id,
          data: {
            name: typebot.name,
          },
        },
      ])
      return res.send(typebot)
    }
    return methodNotAllowed(res)
  } catch (err) {
    console.error(err)
    if (err instanceof Error) {
      return res.status(500).send({ title: err.name, message: err.message })
    }
    return res.status(500).send({ message: 'An error occured', error: err })
  }
}

const removeOldProperties = (data: unknown) => {
  if (data && typeof data === 'object' && 'publishedTypebotId' in data) {
    return omit(data, 'publishedTypebotId')
  }
  return data
}

export default handler
