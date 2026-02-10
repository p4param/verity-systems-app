import { UserRolesClient } from "./_components/UserRolesClient"

export default async function UserRolesPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    return <UserRolesClient userId={Number(id)} />
}
