import { GeneralErrorBoundary } from '#app/components/error-boundary.js'
import {
	DropdownField,
	ErrorList,
	Field,
	TextareaField,
} from '#app/components/forms.js'
import { Spacer } from '#app/components/spacer.js'
import { Button } from '#app/components/ui/button.js'
import { Icon } from '#app/components/ui/icon.js'
import { StatusButton } from '#app/components/ui/status-button.js'
import { getUserInfo } from '#app/utils/auth.server.js'
import { checkHoneypot } from '#app/utils/honeypot.server.js'
import { useIsPending } from '#app/utils/misc.js'
import {
	getDischargeSummaryInfo,
	updateDischargeSummary,
} from '#app/utils/patients.server.js'
import { redirectWithToast } from '#app/utils/toast.server.js'
import {
	getFormProps,
	getInputProps,
	getSelectProps,
	getTextareaProps,
	useForm,
	type FieldMetadata,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { ActionFunctionArgs, json, LoaderFunctionArgs } from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'
import { useRef, useState } from 'react'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'

const DrugFieldlistSchema = z.object({
	name: z.string(),
	strength: z.string(),
	frequency: z.string(),
	duration: z.string(),
	time: z.string(),
})

const EditDischargeSummaryFormSchema = z.object({
	finalDiagnosis: z.string(),
	complaintsOnReporting: z.string().optional(),
	pastHistory: z.string().optional(),
	historyOfPresentingIllness: z.string().optional(),
	physicalFindingsOfExamination: z.string().optional(),
	laboratoryData: z.string().optional(),
	investigationProcedure: z.string().optional(),
	therapeuticProcedure: z.string().optional(),
	coursesOfTreatmentInHospital: z.string().optional(),
	summaryOfICUStay: z.string().optional(),
	futureAdviceOnDischarge: z.string().optional(),
	dischargeDate: z.date().optional(),
	admitDate: z.date().optional(),
	summaryDrugInstruction: z.array(DrugFieldlistSchema).optional(),
	dischargeSummaryId: z.string(),
	hospitalId: z.string(),
	paymentType: z.enum(['Card', 'Cash', 'UPI', 'Insurance']),
})

export async function loader({ request, params }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const userInfo = await getUserInfo(request)
	invariantResponse(userInfo, 'User info not found', { status: 404 })
	const { dischargeSummaryId } = params
	invariantResponse(dischargeSummaryId, 'Discharge Summary is not available', {
		status: 404,
	})
	const dischargeSummaryInfo = await getDischargeSummaryInfo({
		dischargeSummaryId,
		hospitalId: userInfo.hospitalId,
	})
	const admitDate = dischargeSummaryInfo.admitDate
	const dischargeDate = dischargeSummaryInfo.dischargeDate
	const modifiedAdmitDate = admitDate
		? admitDate.toISOString().split('T')[0]
		: ''
	const modifiedDischargeDate = dischargeDate
		? dischargeDate.toISOString().split('T')[0]
		: ''
	return json({
		...dischargeSummaryInfo,
		admitDate: modifiedAdmitDate,
		dischargeDate: modifiedDischargeDate,
	})
}

export async function action({ request }: ActionFunctionArgs) {
	// TODO: How check if there is changes in data from previous state
	const userInfo = await getUserInfo(request)
	invariantResponse(userInfo, 'User info not found', { status: 404 })
	const formData = await request.formData()
	checkHoneypot(formData)
	const submission = await parseWithZod(formData, {
		schema: intent =>
			EditDischargeSummaryFormSchema.transform(async data => {
				if (intent !== null) return { ...data, session: null }

				return { ...data }
			}),
		async: true,
	})
	if (submission.status !== 'success') {
		return json({ status: submission.status === 'error' ? 400 : 200 })
	}
	const dischargeSummaryInfo = await updateDischargeSummary({
		dischargeSummary: submission.value,
	})
	if (dischargeSummaryInfo) {
		return redirectWithToast(
			`/in-patients/ds/${dischargeSummaryInfo.id}/view`,
			{
				type: 'success',
				title: 'Discharge Summary updated',
				description: 'Discharge Summary has been updated successfully.',
			},
			{ status: 302 },
		)
	}
	return null
}
export default function ShowDischargeSummary() {
	const isPending = useIsPending()
	const data = useLoaderData<typeof loader>()

	const [form, fields] = useForm({
		id: 'in-patient-registration-form',
		constraint: getZodConstraint(EditDischargeSummaryFormSchema),
		defaultValue: { ...data },
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: EditDischargeSummaryFormSchema })
		},
		shouldRevalidate: 'onBlur',
	})
	const drugsListFields = fields.summaryDrugInstruction.getFieldList()
	return (
		<div className="container flex min-h-full flex-col justify-center rounded-3xl bg-muted pb-32 pt-10">
			<div className="max-w-2lg mx-auto w-full">
				<div className="flex flex-col gap-3 text-center">
					<h1 className="text-h1">Discharge Summary!</h1>
					<p className="text-body-md text-muted-foreground">
						Edit Discharge Summary Details
					</p>
				</div>
				<Spacer size="xs" />
				<Form method="POST" {...getFormProps(form)}>
					<HoneypotInputs />
					<input type="hidden" name="dischargeSummaryId" value={data.id} />
					<input type="hidden" name="hospitalId" value={data.hospitalId} />
					<div>
						<TextareaField
							labelProps={{ children: 'Final Diagnosis' }}
							textareaProps={{
								...getTextareaProps(fields.finalDiagnosis),
							}}
							errors={fields.finalDiagnosis.errors}
						/>
						<TextareaField
							labelProps={{ children: 'Complaints On Reporting' }}
							textareaProps={{
								...getTextareaProps(fields.complaintsOnReporting),
							}}
							errors={fields.complaintsOnReporting.errors}
						/>
						<TextareaField
							labelProps={{ children: 'Past History' }}
							textareaProps={{
								...getTextareaProps(fields.pastHistory),
							}}
							errors={fields.pastHistory.errors}
						/>
						<TextareaField
							labelProps={{ children: 'History Of Presenting Illness' }}
							textareaProps={{
								...getTextareaProps(fields.historyOfPresentingIllness),
							}}
							errors={fields.historyOfPresentingIllness.errors}
						/>
						<TextareaField
							labelProps={{ children: 'Physical Findings Of Examination' }}
							textareaProps={{
								...getTextareaProps(fields.physicalFindingsOfExamination),
							}}
							errors={fields.physicalFindingsOfExamination.errors}
						/>
						<TextareaField
							labelProps={{ children: 'Laboratory Data' }}
							textareaProps={{
								...getTextareaProps(fields.laboratoryData),
							}}
							errors={fields.laboratoryData.errors}
						/>
						<TextareaField
							labelProps={{ children: 'Investigation Procedure' }}
							textareaProps={{
								...getTextareaProps(fields.investigationProcedure),
							}}
							errors={fields.investigationProcedure.errors}
						/>
						<TextareaField
							labelProps={{ children: 'Therapeutic Procedure' }}
							textareaProps={{
								...getTextareaProps(fields.therapeuticProcedure),
							}}
							errors={fields.therapeuticProcedure.errors}
						/>
						<TextareaField
							labelProps={{ children: 'Courses Of Treatment In Hospital' }}
							textareaProps={{
								...getTextareaProps(fields.coursesOfTreatmentInHospital),
							}}
							errors={fields.coursesOfTreatmentInHospital.errors}
						/>
						<TextareaField
							labelProps={{ children: 'Summary Of ICU Stay' }}
							textareaProps={{
								...getTextareaProps(fields.summaryOfICUStay),
							}}
							errors={fields.summaryOfICUStay.errors}
						/>
						<TextareaField
							labelProps={{ children: 'Future Advice On Discharge' }}
							textareaProps={{
								...getTextareaProps(fields.futureAdviceOnDischarge),
							}}
							errors={fields.futureAdviceOnDischarge.errors}
						/>
						<div>Summary Drug Instruction</div>
						<div>
							<Button
								className="mt-3"
								{...form.insert.getButtonProps({
									name: fields.summaryDrugInstruction.name,
								})}
							>
								<span aria-hidden>
									<Icon name="plus">Drug</Icon>
								</span>{' '}
								<span className="sr-only">Add drug</span>
							</Button>
						</div>
						<div className="mt-5">
							<ul>
								{drugsListFields.map((drug, index) => {
									return (
										<li key={drug.key}>
											<div className="flex gap-4">
												<DrugChooser drug={drug} />
												<button
													className="text-foreground-destructive"
													{...form.remove.getButtonProps({
														name: fields.summaryDrugInstruction.name,
														index,
													})}
												>
													<span aria-hidden>
														<Icon name="cross-1" />
													</span>{' '}
													<span className="sr-only">
														Remove drug {index + 1}
													</span>
												</button>
											</div>
										</li>
									)
								})}
							</ul>
						</div>
					</div>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:gap-8 xl:gap-12">
						<div>
							<Field
								labelProps={{
									htmlFor: fields.admitDate.id,
									children: 'Admit Date',
								}}
								inputProps={{
									...getInputProps(fields.admitDate, { type: 'date' }),
									autoComplete: 'admitDate',
								}}
								errors={fields.admitDate.errors}
							/>
						</div>
						<div>
							<Field
								labelProps={{
									htmlFor: fields.dischargeDate.id,
									children: 'Discharge Date',
								}}
								inputProps={{
									...getInputProps(fields.dischargeDate, { type: 'date' }),
									autoComplete: 'dischargeDate',
								}}
								errors={fields.dischargeDate.errors}
							/>
						</div>
					</div>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:gap-8 xl:gap-12">
						<DropdownField
							labelProps={{
								htmlFor: fields.paymentType.id,
								children: 'Payment Type',
							}}
							selectProps={getSelectProps(fields.paymentType)}
							errors={fields.paymentType.errors}
							// autoComplete="paymentType"
							dropDownOptions={[
								{ value: 'Card', label: 'Card' },
								{ value: 'Cash', label: 'Cash' },
								{ value: 'UPI', label: 'UPI' },
								{ value: 'Insurance', label: 'Insurance' },
							]}
						/>
					</div>
					<ErrorList errors={form.errors} id={form.errorId} />
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:gap-8 xl:gap-12">
						<div></div>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:gap-8 xl:gap-12">
							<StatusButton
								className="w-full"
								status={isPending ? 'pending' : form.status ?? 'idle'}
								type="reset"
								disabled={isPending}
								name="intent"
								value="delete-note"
								variant="ghost"
							>
								Reset
							</StatusButton>
							<StatusButton
								className="w-full"
								status={isPending ? 'pending' : form.status ?? 'idle'}
								type="submit"
								disabled={isPending}
							>
								Save
							</StatusButton>
						</div>
					</div>
				</Form>
			</div>
		</div>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}

function DrugChooser({
	drug,
}: {
	drug: FieldMetadata<z.infer<typeof DrugFieldlistSchema>>
}) {
	const ref = useRef<HTMLFieldSetElement>(null)
	// const fields = useFieldset(ref, config)
	const drugFields = drug.getFieldset()
	// const existingImage = Boolean(drugFields.name.id.defaultValue)
	const [showEditName, setEditName] = useState(false)
	return (
		<fieldset
			ref={ref}
			// TODO: take care of ariel attributes
			// aria-invalid={Boolean(drugFields.errors?.length) || undefined}
			// aria-describedby={
			// 	drugFields.errors?.length ? drugFields.errorId : undefined
			// }
		>
			<div className="flex flex-wrap gap-3 sm:flex-nowrap">
				<Field
					labelProps={{
						htmlFor: drugFields.name.id,
						children: 'Name',
					}}
					inputProps={{
						...getInputProps(drugFields.name, { type: 'text' }),
						autoComplete: 'name',
					}}
					errors={drugFields.name.errors}
				/>
				<Field
					labelProps={{
						htmlFor: drugFields.strength.id,
						children: 'Strength',
					}}
					inputProps={{
						...getInputProps(drugFields.strength, { type: 'text' }),
						autoComplete: 'strength',
					}}
					errors={drugFields.strength.errors}
				/>
				<Field
					labelProps={{
						htmlFor: drugFields.duration.id,
						children: 'No Of Days',
					}}
					inputProps={{
						...getInputProps(drugFields.duration, { type: 'text' }),
						autoComplete: 'duration',
					}}
					errors={drugFields.duration.errors}
				/>
				<DropdownField
					labelProps={{
						htmlFor: drugFields.frequency.id,
						children: 'Frequency',
					}}
					selectProps={getSelectProps(drugFields.frequency)}
					errors={drugFields.frequency.errors}
					dropDownOptions={[
						{ value: '001', label: '0-0-1' },
						{ value: '010', label: '0-1-0' },
						{ value: '001', label: '0-0-1' },
						{ value: '100', label: '1-0-0' },
						{ value: '101', label: '1-0-1' },
						{ value: '110', label: '1-1-0' },
						{ value: '111', label: '1-1-1' },
					]}
				/>
				<DropdownField
					labelProps={{
						htmlFor: drugFields.time.id,
						children: 'When',
					}}
					selectProps={getSelectProps(drugFields.time)}
					errors={drugFields.time.errors}
					dropDownOptions={[
						{ value: 'after', label: 'after' },
						{ value: 'before', label: 'before' },
					]}
				/>
			</div>
		</fieldset>
	)
}
