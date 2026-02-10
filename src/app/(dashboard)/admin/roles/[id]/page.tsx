import { RoleEditor } from "../_components/RoleEditor"

export default async function EditRolePage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    return <RoleEditor roleId={Number(id)} />
}
