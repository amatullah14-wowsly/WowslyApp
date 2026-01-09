import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, Platform, KeyboardAvoidingView, Switch, Modal, Image, Alert, useWindowDimensions } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../../components/BackButton';
import PencilIcon from '../../components/Icons/PencilIcon';
import ChevronDownIcon from '../../components/Icons/ChevronDownIcon';
import { insertOrUpdateRegistrationForm, deleteRegistrationFormFields, getRegistrationFormDetails, getEventDetails, getRegistrationFormStatus, createRegistrationForm } from '../../api/event';
import Toast from 'react-native-toast-message';
import { useScale } from '../../utils/useScale';
import { FontSize } from '../../constants/fontSizes';
import { useTabletScale, useTabletModerateScale } from '../../utils/tabletScaling';
import { ResponsiveContainer } from '../../components/ResponsiveContainer';

// Types
interface FormField {
    id: string;
    label: string; // The value the user types (e.g. "Full Name")
    placeholder: string; // The default placeholder (e.g. "Name")
    type: string;
    isDefault: boolean;
    // Added for API mapping
    mandatory?: boolean | number;
    is_show?: boolean | number;
    options?: any[];
}

const RegistrationFormEditor = ({ isEmbedded = false, eventId: propEventId }: { isEmbedded?: boolean, eventId?: number }) => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { eventId: routeEventId, autoEdit } = route.params || {};
    const eventId = propEventId || routeEventId;

    const { width } = useWindowDimensions();
    const isTablet = width >= 720;
    const { scale, verticalScale, moderateScale } = useScale();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale, insets), [scale, verticalScale, moderateScale, insets]);

    // Mode State
    const [isEditing, setIsEditing] = useState(route.params?.autoEdit || false);
    const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
    const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

    // Form Configuration State
    const [formId, setFormId] = useState<number | null>(null);
    const [formTitle, setFormTitle] = useState('Guest Registration Form');
    const [buttonText, setButtonText] = useState('Registration');
    const [successMessage, setSuccessMessage] = useState('You have successfully registered for this event!!');
    const [emailValidation, setEmailValidation] = useState(false);

    // Fields State
    const [formFields, setFormFields] = useState<FormField[]>([
        { id: 'default_1', label: 'Name', placeholder: 'Name', type: 'text', isDefault: true, mandatory: 1, is_show: 1 },
        { id: 'default_2', label: 'Country Code', placeholder: '+91', type: 'number', isDefault: true, mandatory: 1, is_show: 1 },
        { id: 'default_3', label: 'Mobile Number', placeholder: 'Mobile Number', type: 'text', isDefault: true, mandatory: 1, is_show: 1 },
        { id: 'default_4', label: 'Email', placeholder: 'Email', type: 'text', isDefault: true, mandatory: 1, is_show: 1 },
    ]);

    const [deletedFieldIds, setDeletedFieldIds] = useState<number[]>([]);

    const [newQuestionType, setNewQuestionType] = useState('Short Answer');
    const [newQuestionLabel, setNewQuestionLabel] = useState('');
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);

    const [newOptions, setNewOptions] = useState<string[]>([]);
    const [newOptionText, setNewOptionText] = useState('');

    const questionTypes = [
        'Short Answer',
        'Long Answer',
        'Yes/No Answer',
        'Multiple Choice, Single Answer',
        'Multiple Choice, Multiple Answer',
        'File Upload'
    ];

    // Fetch Form Data on Mount
    useEffect(() => {
        const fetchForm = async () => {
            if (!eventId) return;

            // Fetch Event Details to get the active form ID
            let activeFormId = null;
            try {
                const eventRes = await getEventDetails(eventId);
                if (eventRes && eventRes.data) {
                    activeFormId = eventRes.data.registration_form_id;
                }
            } catch (err) {
                console.log("Error fetching event details:", err);
            }

            const statusRes = await getRegistrationFormStatus(eventId);

            // Logic to check if any form exists
            const hasFormList = statusRes && statusRes.form && Array.isArray(statusRes.form) && statusRes.form.length > 0;
            const singleForm = statusRes && statusRes.data && statusRes.data.id;
            const isFilled = statusRes && statusRes.is_filled === true;

            if (!isFilled && !hasFormList && !singleForm) {
                // NEW FORM FLOW
                setFormFields([
                    { id: 'default_1', label: 'Name', placeholder: 'Name', type: 'text', isDefault: true, mandatory: 1, is_show: 1 },
                    { id: 'default_2', label: 'Country Code', placeholder: '+91', type: 'number', isDefault: true, mandatory: 1, is_show: 1 },
                    { id: 'default_3', label: 'Mobile Number', placeholder: 'Mobile Number', type: 'text', isDefault: true, mandatory: 1, is_show: 1 },
                    { id: 'default_4', label: 'Email', placeholder: 'Email', type: 'text', isDefault: true, mandatory: 1, is_show: 1 },
                ]);
                setFormId(null);
                setFormTitle('Guest Registration Form');
                setIsEditing(false);
            } else {
                // EXISTING FORM FLOW
                console.log("Form exists, fetching details...");

                let regFormId = activeFormId;
                let foundForm = null;

                if (hasFormList) {
                    if (regFormId) {
                        foundForm = statusRes.form.find((f: any) => f.id == regFormId);
                    }
                    if (!foundForm) {
                        // Default to first one if undefined or not found
                        foundForm = statusRes.form[0];
                        regFormId = foundForm.id;
                    }
                } else if (singleForm) {
                    foundForm = statusRes.data;
                    regFormId = statusRes.data.id;
                }

                if (regFormId && foundForm) {
                    setFormId(regFormId);

                    // Directly populate
                    const data = foundForm;
                    setFormTitle(data.title || formTitle);
                    setButtonText(data.form_button_title || buttonText);
                    setSuccessMessage(data.form_registration_success_message || successMessage);
                    setEmailValidation(data.email_validation_required === 1);

                    if (data.fields && Array.isArray(data.fields)) {
                        const mappedFields = data.fields.map((f: any) => ({
                            id: String(f.id),
                            label: f.question,
                            placeholder: f.question,
                            type: f.type,
                            isDefault: f.id <= 7531 || ['Name', 'Country Code', 'Mobile Number', 'Email'].includes(f.question),
                            mandatory: f.mandatory,
                            is_show: f.is_show,
                            options: f.options
                        }));
                        setFormFields(mappedFields);
                    } else {
                        // Fallback
                        const formRes = await getRegistrationFormDetails(eventId, regFormId);
                        if (formRes && formRes.data && formRes.data.fields) {
                            const mappedFields = formRes.data.fields.map((f: any) => ({
                                id: String(f.id),
                                label: f.question,
                                placeholder: f.question,
                                type: f.type,
                                isDefault: f.id <= 7531 || ['Name', 'Country Code', 'Mobile Number', 'Email'].includes(f.question),
                                mandatory: f.mandatory,
                                is_show: f.is_show,
                                options: f.options
                            }));
                            setFormFields(mappedFields);
                        }
                    }
                }
                setIsEditing(autoEdit || false); // Start in PREVIEW mode unless autoEdit is requested
            }
        };
        fetchForm();
    }, [eventId, autoEdit]);

    const handleSave = async (fromAutosave = false, fieldsOverride: FormField[] | null = null) => {
        if (!eventId) {
            Toast.show({ type: 'error', text1: 'Event ID missing' });
            return;
        }

        // 1. Bulk Delete if needed
        if (deletedFieldIds.length > 0 && !fromAutosave) {
            const deletePayload = { form_field_ids: deletedFieldIds };
            const deleteRes = await deleteRegistrationFormFields(eventId, deletePayload);
            if (deleteRes && deleteRes.data) {
                if (!fromAutosave) Toast.show({ type: 'success', text1: 'Fields deleted successfully' });
                setDeletedFieldIds([]);
            }
        }

        // 2. Prepare Payload
        const currentFields = fieldsOverride || formFields;
        const fieldsPayload = currentFields.map(f => ({
            id: isNaN(Number(f.id)) || Number(f.id) > 10000000000 ? null : Number(f.id), // timestamp IDs are null
            question: f.label || f.placeholder || "Question",
            type: f.type,
            mandatory: f.mandatory ? 1 : 0,
            is_show: (f.is_show === 0 || f.is_show === false) ? 0 : 1,
            options: f.options || [],
            exists: !isNaN(Number(f.id)) && Number(f.id) < 10000000000 // Simple heuristic: 13-digit timestamp vs 4-digit ID
        }));


        const validFields = fieldsPayload.map(f => {
            if (!f.exists) {
                // remove ID if not exists
                const { id, ...rest } = f;
                return rest;
            }
            return f;
        });

        const payload = {
            form_title: formTitle,
            form_button_title: buttonText,
            form_registration_success_message: successMessage,
            email_validation_required: emailValidation ? 1 : 0,
            fields: validFields
        };

        let response;
        if (!formId) {
            // CREATE NEW FORM
            console.log("Calling createRegistrationForm...");
            response = await createRegistrationForm(eventId, payload);
        } else {
            // UPDATE EXISTING FORM
            const currentFormId = formId;
            console.log("Calling insertOrUpdateRegistrationForm...");
            response = await insertOrUpdateRegistrationForm(eventId, currentFormId, payload);
        }


        if (response && (response.data || response.success)) {
            const responseData = response.data || response;

            if (!fromAutosave) Toast.show({ type: 'success', text1: 'Form Saved' });

            const savedFormId = formId || responseData.id;
            if (savedFormId) {
                setFormId(savedFormId);

                // OPTIMIZATION: Use fields from response if available to avoid race conditions with checking details immediately
                if (responseData.fields && Array.isArray(responseData.fields)) {
                    const mappedFields = responseData.fields.map((f: any) => ({
                        id: String(f.id),
                        label: f.question,
                        placeholder: f.question,
                        type: f.type,
                        isDefault: f.id <= 7531 || ['Name', 'Country Code', 'Mobile Number', 'Email'].includes(f.question),
                        mandatory: f.mandatory,
                        is_show: f.is_show,
                        options: f.options
                    }));
                    setFormFields(mappedFields.length > 0 ? mappedFields : formFields);
                } else {
                    // Fallback: Fetch Fresh Details if fields missing in response
                    const detailsRes = await getRegistrationFormDetails(eventId, savedFormId);
                    if (detailsRes && detailsRes.data) {
                        const data = detailsRes.data;
                        setFormTitle(data.title || formTitle);
                        setButtonText(data.form_button_title || buttonText);
                        setSuccessMessage(data.form_registration_success_message || successMessage);
                        setEmailValidation(data.email_validation_required === 1);

                        if (data.fields && Array.isArray(data.fields)) {
                            const mappedFields = data.fields.map((f: any) => ({
                                id: String(f.id),
                                label: f.question,
                                placeholder: f.question,
                                type: f.type,
                                isDefault: f.id <= 7531 || ['Name', 'Country Code', 'Mobile Number', 'Email'].includes(f.question),
                                mandatory: f.mandatory,
                                is_show: f.is_show,
                                options: f.options
                            }));
                            setFormFields(mappedFields.length > 0 ? mappedFields : formFields);
                        }
                    }
                }
            }

            if (!fromAutosave) setIsEditing(false);
        } else {
            if (!fromAutosave) Toast.show({ type: 'error', text1: 'Failed to save' });
        }
    };

    const handleFieldChange = (text: string, id: string) => {
        setFormFields(current =>
            current.map(field =>
                field.id === id ? { ...field, label: text } : field
            )
        );
    };

    const handleAddQuestion = () => {
        setShowAddQuestionModal(true);
        setNewQuestionLabel('');
        setNewQuestionType('Short Answer');
        setNewOptions([]); // Reset options
        setNewOptionText('');
        setShowTypeDropdown(false);
        setEditingFieldId(null);
    }

    const confirmAddQuestion = () => {
        if (!newQuestionLabel.trim()) return;

        let apiType = 'text';
        if (newQuestionType === 'Mobile Number' || newQuestionType === 'Country Code') apiType = 'number';
        else if (newQuestionType === 'Long Answer') apiType = 'textarea';
        else if (newQuestionType === 'Yes/No Answer') apiType = 'switch';
        else if (newQuestionType === 'Multiple Choice, Single Answer') apiType = 'radio';
        else if (newQuestionType === 'Multiple Choice, Multiple Answer') apiType = 'checkbox';
        else if (newQuestionType === 'File Upload') apiType = 'file';

        if (editingFieldId) {
            // Update existing field
            const updatedFields = formFields.map(f => {
                if (f.id === editingFieldId) {
                    return {
                        ...f,
                        label: newQuestionLabel,
                        placeholder: newQuestionLabel,
                        type: apiType,
                        options: (newQuestionType.includes('Multiple Choice') && newOptions.length > 0) ? newOptions : [],
                        // Keep other props
                    };
                }
                return f;
            });
            setFormFields(updatedFields);
            setEditingFieldId(null);
            setNewQuestionLabel('');
            setShowAddQuestionModal(false);
            handleSave(true, updatedFields);
        } else {
            // Add new field
            const newField: FormField = {
                id: Date.now().toString(),
                label: newQuestionLabel,
                placeholder: newQuestionLabel,
                type: apiType,
                isDefault: false,
                mandatory: 0,
                is_show: 1,
                options: (newQuestionType.includes('Multiple Choice') && newOptions.length > 0) ? newOptions : []
            };

            const updatedFields = [...formFields, newField];
            setFormFields(updatedFields);
            setNewQuestionLabel('');
            setShowAddQuestionModal(false);

            // Trigger Autosave with new fields
            handleSave(true, updatedFields);
        }
    };

    const handleEditQuestion = (field: FormField) => {
        setEditingFieldId(field.id);
        setNewQuestionLabel(field.label);

        let uiType = 'Short Answer';
        if (field.type === 'textarea') uiType = 'Long Answer';
        else if (field.type === 'switch') uiType = 'Yes/No Answer';
        else if (field.type === 'radio') uiType = 'Multiple Choice, Single Answer';
        else if (field.type === 'checkbox') uiType = 'Multiple Choice, Multiple Answer';
        else if (field.type === 'file') uiType = 'File Upload';

        setNewQuestionType(uiType);

        // Load existing options
        setNewOptions(field.options && field.options.length > 0 ? field.options : []);
        setNewOptionText('');

        setShowAddQuestionModal(true);
    };

    const handleAddOption = () => {
        if (newOptionText.trim()) {
            setNewOptions([...newOptions, newOptionText.trim()]);
            setNewOptionText('');
        }
    };

    const handleRemoveOption = (index: number) => {
        const updatedOptions = [...newOptions];
        updatedOptions.splice(index, 1);
        setNewOptions(updatedOptions);
    };

    const handleToggleVisibility = (id: string) => {
        const updatedFields = formFields.map(f => {
            if (f.id === id) {
                return { ...f, is_show: f.is_show === 1 ? 0 : 1 };
            }
            return f;
        });
        setFormFields(updatedFields);
        // Autosave visibility change?
        handleSave(true, updatedFields);
    };

    const handleDeleteField = (id: string) => {
        Alert.alert(
            "Delete Question",
            "Are you sure you want to delete this question?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        if (!isNaN(Number(id)) && id.length < 10) {
                            setDeletedFieldIds(prev => [...prev, Number(id)]);
                        }

                        setFormFields(prev => prev.filter(f => f.id !== id));
                        // Removed autosave to prevent "undelete" race condition. 
                        // Deletion will be synced when user clicks "Save" via deletedFieldIds.
                    }
                }
            ]
        );
    };

    // Placeholder for cancel
    const handleCancel = () => {
        setIsEditing(false);
        // Optionally reset state if we were tracking initial state
    };

    // --- RENDER HELPERS ---

    const renderFieldPreview = (field: FormField) => {
        // Standard Layout: Label Above Field
        const Label = () => (
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: moderateScale(FontSize.md), color: '#333', marginBottom: verticalScale(2), fontWeight: '500' }}>
                {field.label} {!!field.mandatory && <Text style={{ color: 'red' }}>*</Text>}
            </Text>
        );

        switch (field.type) {
            case 'switch':
                return (
                    <View style={styles.fieldContainer}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: scale(8), padding: scale(12) }}>
                            <Text style={{ fontSize: moderateScale(FontSize.md), color: '#333' }}>{field.label}</Text>
                            <Switch
                                trackColor={{ false: "#767577", true: "#FF8A3C" }}
                                thumbColor={'#fff'}
                                value={false}
                                disabled={true}
                            />
                        </View>
                    </View>
                );
            case 'radio':
            case 'Multiple Choice, Single Answer':
                return (
                    <View style={styles.fieldContainer}>
                        <Label />
                        <View style={{ gap: verticalScale(10) }}>
                            {field.options && field.options.map((opt, idx) => (
                                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: scale(8), padding: scale(12) }}>
                                    <View style={{
                                        height: scale(20),
                                        width: scale(20),
                                        borderRadius: scale(10),
                                        borderWidth: 1.5,
                                        borderColor: '#666',
                                        marginRight: scale(10)
                                    }} />
                                    <Text style={styles.optionText}>{opt}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                );
            case 'checkbox':
            case 'Multiple Choice, Multiple Answer':
                return (
                    <View style={styles.fieldContainer}>
                        <Label />
                        <View style={{ gap: verticalScale(10) }}>
                            {field.options && field.options.map((opt, idx) => (
                                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: scale(8), padding: scale(12) }}>
                                    <View style={{
                                        height: scale(20),
                                        width: scale(20),
                                        borderWidth: 1.5,
                                        borderColor: '#666',
                                        marginRight: scale(10)
                                    }} />
                                    <Text style={styles.optionText}>{opt}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                );
            case 'file':
                return (
                    <View style={styles.fieldContainer}>
                        <Label />
                        <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 15, borderStyle: 'dashed' }}>
                            <Image
                                source={require('../../assets/img/eventdashboard/upload.png')}
                                style={{ width: 24, height: 24, marginRight: 10, tintColor: '#5F6368', opacity: 0.7 }}
                                resizeMode="contain"
                            />
                            <Text style={{ color: '#333', fontSize: 14 }}>Upload File</Text>
                        </View>
                    </View>
                );
            case 'textarea':
                return (
                    <View style={styles.fieldContainer}>
                        <Label />
                        <TextInput
                            style={[styles.cleanInput, { height: verticalScale(100), textAlignVertical: 'top', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: scale(8), padding: scale(12), backgroundColor: 'white' }]}
                            placeholder={"Your answer"}
                            placeholderTextColor="#999"
                            editable={false}
                            multiline={true}
                        />
                    </View>
                );
            case 'text':
            case 'number':
            case 'email':
            default:
                return (
                    <View style={styles.fieldContainer}>
                        <Label />
                        <TextInput
                            style={{
                                borderWidth: 1,
                                borderColor: '#E0E0E0',
                                borderRadius: scale(8),
                                paddingHorizontal: scale(10),
                                paddingVertical: verticalScale(12),
                                fontSize: moderateScale(FontSize.md),
                                color: '#333',
                                backgroundColor: 'white'
                            }}
                            placeholder={field.placeholder || "Your answer"}
                            placeholderTextColor="#999"
                            editable={false}
                        />
                    </View>
                );
        }
    };

    const renderPreviewMode = () => (
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }} edges={['left', 'right', 'bottom']}>
            {!isEmbedded && (
                <View style={[styles.header, { backgroundColor: 'white', borderBottomWidth: 0 }]}>
                    <BackButton onPress={() => navigation.goBack()} />
                    <Text style={[styles.headerTitle, { flex: 1, textAlign: 'center' }]}>Preview Form</Text>
                    {/* Edit Icon Right aligned */}
                    <TouchableOpacity
                        style={styles.editIconContainer}
                        onPress={() => {
                            if (isEmbedded) {
                                (navigation as any).navigate('RegistrationFormEditor', { eventId, autoEdit: true });
                            } else {
                                setIsEditing(true);
                            }
                        }}
                    >
                        <Image source={require('../../assets/img/form/edit.png')} style={{ width: 24, height: 24, tintColor: '#333' }} resizeMode="contain" />
                    </TouchableOpacity>
                </View>
            )}

            <ScrollView contentContainerStyle={[styles.content]}>

                {/* Clean Title Header */}
                <View style={{ marginBottom: 20, marginTop: 10 }}>
                    <Text style={{ fontSize: 24, fontWeight: '700', color: '#000', textAlign: 'center' }}>{formTitle || "Guest Registration Form"}</Text>
                    <View style={{ height: 2, width: 40, backgroundColor: '#000', marginTop: 10, alignSelf: 'center' }} />
                </View>

                {/* Form Fields List */}
                <View style={{ gap: 8 }}>
                    {formFields.filter(f => f.is_show !== 0 && f.is_show !== false).map((field, index, array) => {
                        if (field.label === 'Country Code') {
                            const mobileField = array.find(f => f.label === 'Mobile Number');
                            if (mobileField) {
                                return (
                                    <View key={field.id} style={{ marginBottom: verticalScale(20) }}>
                                        {/* Single Heading */}
                                        <Text style={{ fontSize: moderateScale(FontSize.md), color: '#333', marginBottom: verticalScale(2), fontWeight: '500' }}>
                                            Mobile Number {!!mobileField.mandatory && <Text style={{ color: 'red' }}>*</Text>}
                                        </Text>

                                        <View style={{ flexDirection: 'row', gap: scale(10) }}>
                                            {/* Small Box - Country Code */}
                                            <View style={{ flex: 0.28 }}>
                                                <TextInput
                                                    style={{
                                                        borderWidth: 1,
                                                        borderColor: '#E0E0E0',
                                                        borderRadius: scale(8),
                                                        paddingHorizontal: scale(10),
                                                        paddingVertical: verticalScale(12),
                                                        fontSize: moderateScale(FontSize.md),
                                                        color: '#333',
                                                        backgroundColor: 'white',
                                                        textAlign: 'center'
                                                    }}
                                                    placeholder="+91"
                                                    placeholderTextColor="#333"
                                                    editable={false}
                                                    value="+91"
                                                />
                                            </View>

                                            {/* Large Box - Mobile Number */}
                                            <View style={{ flex: 0.72 }}>
                                                <TextInput
                                                    style={{
                                                        borderWidth: 1,
                                                        borderColor: '#E0E0E0',
                                                        borderRadius: scale(8),
                                                        paddingHorizontal: scale(10),
                                                        paddingVertical: verticalScale(12),
                                                        fontSize: moderateScale(FontSize.md),
                                                        color: '#333',
                                                        backgroundColor: 'white'
                                                    }}
                                                    placeholder="Mobile Number"
                                                    placeholderTextColor="#999"
                                                    editable={false}
                                                />
                                            </View>
                                        </View>
                                    </View>
                                );
                            }
                        }
                        if (field.label === 'Mobile Number') {
                            const countryField = array.find(f => f.label === 'Country Code');
                            if (countryField) return null; // Already rendered with Country Code
                        }
                        return (
                            <View key={field.id}>
                                {renderFieldPreview(field)}
                            </View>
                        );
                    })}
                </View>

                {/* Submit Button */}
                <View style={{ marginTop: 20, marginBottom: 40 }}>
                    <View style={{
                        backgroundColor: '#FF8A3C',
                        borderRadius: scale(8),
                        paddingVertical: verticalScale(15),
                        alignItems: 'center',
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: verticalScale(2) },
                        shadowOpacity: 0.1,
                        shadowRadius: scale(4),
                        elevation: 3
                    }}>
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: moderateScale(FontSize.lg) }}>{buttonText || "Registration"}</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Floating Edit Button if standard mode */}
            {!isEmbedded && (
                <TouchableOpacity
                    style={{ position: 'absolute', bottom: verticalScale(30), right: moderateScale(20), width: moderateScale(56), height: moderateScale(56), borderRadius: moderateScale(28), backgroundColor: '#FF8A3C', elevation: 6, justifyContent: 'center', alignItems: 'center' }}
                    onPress={() => setIsEditing(true)}
                >
                    <Image source={require('../../assets/img/form/edit.png')} style={{ width: moderateScale(24), height: moderateScale(24), tintColor: 'white' }} resizeMode="contain" />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );

    const renderEditMode = () => (
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }} edges={['left', 'right', 'bottom']}>
            {!isEmbedded && (
                <View style={[styles.header, { backgroundColor: 'white', borderBottomWidth: 0, elevation: 2 }]}>
                    <BackButton onPress={() => setIsEditing(false)} />
                    <Text style={styles.headerTitle}>Edit Form</Text>
                    <View style={{ width: scale(40) }} />
                </View>
            )}
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: verticalScale(100) }]}>

                {/* Single Consolidated Card for Editor - Admin Style */}
                <View style={[styles.card, { padding: scale(15) }]}>
                    <View style={styles.sectionContainer}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Form title</Text>
                            <TextInput
                                style={styles.textInput}
                                value={formTitle}
                                onChangeText={setFormTitle}
                            />
                        </View>
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Button Text</Text>
                            <TextInput
                                style={styles.textInput}
                                value={buttonText}
                                onChangeText={setButtonText}
                            />
                        </View>
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Registration Success Message</Text>
                            <TextInput
                                style={styles.textInput}
                                value={successMessage}
                                onChangeText={setSuccessMessage}
                            />
                        </View>
                        <Text style={[styles.helperText, { color: '#888', fontSize: moderateScale(FontSize.sm) }]}>Basic contact fields are fixed and cannot be edited.</Text>
                    </View>

                    {/* Questions List */}
                    <View style={{ gap: verticalScale(10) }}>
                        {formFields.map((field) => (
                            <View key={field.id} style={{ marginBottom: 0 }}>
                                <View style={[styles.readOnlyField, styles.customFieldRow]}>
                                    {/* Unified Input Style for All Fields */}
                                    <TextInput
                                        style={[
                                            styles.readOnlyInput,
                                            { flex: 1, height: 50, color: field.isDefault ? '#999' : '#333' },
                                            {
                                                borderWidth: 1,
                                                borderColor: '#E0E0E0',
                                                borderRadius: 12,
                                                backgroundColor: field.isDefault ? '#F9F9F9' : 'white'
                                            }
                                        ]}
                                        value={field.label}
                                        onChangeText={(text) => handleFieldChange(text, field.id)}
                                        placeholder={field.placeholder}
                                        editable={!field.isDefault}
                                    />

                                    {/* Action Icons - Visible ONLY for Custom Fields */}
                                    {!field.isDefault && (
                                        <View style={styles.actionIconsRow}>
                                            <TouchableOpacity style={styles.actionIcon} onPress={() => handleEditQuestion(field)}>
                                                <Image source={require('../../assets/img/form/edit.png')} style={{ width: scale(20), height: scale(20), resizeMode: 'contain', tintColor: '#FF8A3C' }} />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.actionIcon} onPress={() => handleToggleVisibility(field.id)}>
                                                <Image
                                                    source={field.is_show ? require('../../assets/img/form/visible.png') : require('../../assets/img/form/hide.png')}
                                                    style={{ width: scale(22), height: scale(22), resizeMode: 'contain', opacity: field.is_show ? 1 : 0.6, tintColor: '#FF8A3C' }}
                                                />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.actionIcon} onPress={() => handleDeleteField(field.id)}>
                                                <Image source={require('../../assets/img/form/trash.png')} style={{ width: scale(20), height: scale(20), resizeMode: 'contain', tintColor: '#FF8A3C' }} />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                {/* Email Toggle */}
                                {field.label === 'Email' && (
                                    <View style={[styles.toggleRow, { marginTop: verticalScale(15), marginBottom: 0, paddingHorizontal: 0, justifyContent: 'space-between' }]}>
                                        <Text style={{ fontSize: moderateScale(FontSize.sm), color: '#202124' }}>Collect strings (Email Validation)</Text>
                                        <Switch
                                            trackColor={{ false: "#767577", true: "#FF8A3C" }}
                                            thumbColor={emailValidation ? "#white" : "#f4f3f4"}
                                            value={emailValidation}
                                            onValueChange={setEmailValidation}
                                        />
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>

                    {/* Add Question UI */}
                    {/* Add Question UI - Standard Block */}
                    {showAddQuestionModal ? (
                        <View style={{ borderWidth: 1, borderColor: '#FF8A3C', borderRadius: moderateScale(12), padding: moderateScale(20), marginTop: verticalScale(20), backgroundColor: '#FFF5EB' }}>
                            {/* Question Type Selector */}
                            <View style={[styles.inputContainer, { zIndex: 2000 }]} >
                                <Text style={{ fontSize: moderateScale(FontSize.xs), color: '#666', marginBottom: verticalScale(5), fontWeight: '500' }}>Question Type</Text>
                                <TouchableOpacity
                                    style={[styles.textInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                                    onPress={() => setShowTypeDropdown(!showTypeDropdown)}
                                >
                                    <Text style={{ color: '#333' }}>{newQuestionType}</Text>
                                    <ChevronDownIcon width={moderateScale(20)} height={moderateScale(20)} color="#666" />
                                </TouchableOpacity>

                                {showTypeDropdown && (
                                    <View style={styles.dropdownList}>
                                        {questionTypes.map((type, index) => (
                                            <TouchableOpacity
                                                key={index}
                                                style={styles.dropdownItem}
                                                onPress={() => {
                                                    setNewQuestionType(type);
                                                    setShowTypeDropdown(false);
                                                }}
                                            >
                                                <Text style={styles.dropdownText}>{type}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            {/* Question Text Input */}
                            <View style={[styles.inputContainer, { zIndex: 1000 }]}>
                                <TextInput
                                    style={styles.textInput}
                                    value={newQuestionLabel}
                                    onChangeText={setNewQuestionLabel}
                                    placeholder="Type your question"
                                    placeholderTextColor="#999"
                                />
                            </View>

                            {/* Options Input for Multiple Choice */}
                            {(newQuestionType === 'Multiple Choice, Single Answer' || newQuestionType === 'Multiple Choice, Multiple Answer') && (
                                <View>
                                    <View style={[styles.inputContainer, { flexDirection: 'row', alignItems: 'center', gap: scale(10) }]}>
                                        <TextInput
                                            style={[styles.textInput, { flex: 1 }]}
                                            placeholder="Add option"
                                            placeholderTextColor="#999"
                                            value={newOptionText}
                                            onChangeText={setNewOptionText}
                                        />
                                        <TouchableOpacity onPress={handleAddOption}>
                                            <Text style={{ fontSize: moderateScale(30), color: '#FF8A3C', fontWeight: '500' }}>+</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Chips */}
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: scale(10), marginTop: verticalScale(5), marginBottom: verticalScale(15) }}>
                                        {newOptions.map((opt, idx) => (
                                            <View key={idx} style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                backgroundColor: '#FF8A3C',
                                                borderRadius: scale(20),
                                                paddingHorizontal: scale(15),
                                                paddingVertical: verticalScale(8),
                                                gap: scale(8)
                                            }}>
                                                <Text style={{ color: 'white', fontSize: moderateScale(FontSize.sm) }}>{opt}</Text>
                                                <TouchableOpacity onPress={() => handleRemoveOption(idx)}>
                                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>×</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Buttons */}
                            <View style={styles.modalButtons}>
                                <TouchableOpacity onPress={() => { setShowAddQuestionModal(false); setEditingFieldId(null); }} style={styles.modalCancelButton}>
                                    <Text style={styles.modalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={confirmAddQuestion} style={[styles.modalAddButton, { opacity: newQuestionLabel ? 1 : 0.6 }]} disabled={!newQuestionLabel}>
                                    <Text style={styles.modalAddText}>{editingFieldId ? 'Update' : 'Add'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.addQuestionButton} onPress={handleAddQuestion}>
                            <Text style={styles.addQuestionText}>+ Add New Question</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView >

            <View style={styles.footerButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setIsEditing(false)}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveFooterButton} onPress={() => handleSave(false)}>
                    <Text style={styles.saveFooterButtonText}>Save</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView >
    );

    // Wrapper Logic: Always View because inner components handle Safe Area
    const Wrapper = View;
    const wrapperStyle = isEmbedded ? { flex: 1, backgroundColor: '#fff' } : styles.container;

    return (
        <Wrapper style={wrapperStyle}>
            <ResponsiveContainer maxWidth={isTablet ? 900 : 420}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                    {isEditing ? renderEditMode() : renderPreviewMode()}
                </KeyboardAvoidingView>
            </ResponsiveContainer>
        </Wrapper>
    )
}

export default RegistrationFormEditor

const makeStyles = (scale: (size: number) => number, verticalScale: (size: number) => number, moderateScale: (size: number, factor?: number) => number, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: moderateScale(20),
        paddingTop: insets.top + verticalScale(10),
        paddingBottom: verticalScale(16),
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    headerTitle: {
        fontSize: moderateScale(16),
        fontWeight: '600',
        color: '#333',
    },
    editIconContainer: {
        padding: moderateScale(5),
    },
    content: {
        padding: moderateScale(20),
        paddingBottom: verticalScale(100),
    },
    card: {
        backgroundColor: 'white',
        borderRadius: moderateScale(12),
        padding: moderateScale(20),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: verticalScale(2) },
        shadowOpacity: 0.05,
        shadowRadius: moderateScale(10),
        elevation: 3,
        marginBottom: verticalScale(20),
    },
    blockContainer: {
        backgroundColor: 'white',
        borderRadius: moderateScale(12),
        padding: moderateScale(20),
        marginBottom: verticalScale(15),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: verticalScale(4) },
        shadowOpacity: 0.08,
        shadowRadius: moderateScale(12),
        elevation: 4,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    questionBlock: {
        backgroundColor: 'white',
        borderRadius: moderateScale(8),
        padding: moderateScale(20),
        marginBottom: verticalScale(15),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: verticalScale(1) },
        shadowOpacity: 0.05, // Very soft for questions
        shadowRadius: moderateScale(2),
        elevation: 2,
    },
    headerInput: {
        fontSize: moderateScale(26),
        fontWeight: '700',
        color: '#202124',
        paddingVertical: verticalScale(10),
        marginBottom: verticalScale(10),
    },
    cleanInput: {
        fontSize: moderateScale(15),
        color: '#202124',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: moderateScale(12),
        paddingHorizontal: moderateScale(15),
        paddingVertical: verticalScale(12),
        marginBottom: verticalScale(10),
        backgroundColor: '#FCFCFC',
    },
    staticFieldLabel: {
        fontSize: moderateScale(16),
        fontWeight: '500',
        color: '#202124',
        marginBottom: verticalScale(5),
    },
    staticFieldPlaceholder: {
        fontSize: moderateScale(14),
        color: '#888',
        paddingVertical: verticalScale(12),
        paddingHorizontal: moderateScale(15),
        borderWidth: 1,
        borderColor: '#F0F0F0',
        borderRadius: moderateScale(10),
        backgroundColor: '#FAFAFA',
        marginTop: verticalScale(5),
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: verticalScale(20),
    },
    cardTitle: {
        fontSize: moderateScale(18),
        fontWeight: '700',
        color: '#333',
    },
    fieldsContainer: {
        gap: verticalScale(15),
    },
    inputWrapper: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: moderateScale(12),
        backgroundColor: 'white',
    },
    input: {
        paddingHorizontal: moderateScale(15),
        paddingVertical: verticalScale(12),
        fontSize: moderateScale(15),
        color: '#333',
    },
    // Settings Styles
    sectionContainer: {
        marginBottom: verticalScale(30),
    },
    inputContainer: {
        marginBottom: verticalScale(20),
        position: 'relative',
    },
    inputLabel: {
        position: 'absolute',
        top: verticalScale(-10),
        left: moderateScale(10),
        backgroundColor: 'white',
        paddingHorizontal: moderateScale(5),
        fontSize: moderateScale(FontSize.xs),
        color: '#666',
        zIndex: 1,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: moderateScale(12),
        paddingHorizontal: moderateScale(15),
        paddingVertical: moderateScale(12),
        fontSize: moderateScale(FontSize.md),
        color: '#333',
        backgroundColor: '#FCFCFC',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: verticalScale(15),
        gap: moderateScale(15),
    },
    toggleLabel: {
        fontSize: moderateScale(FontSize.md),
        color: '#333',
    },
    helperText: {
        fontSize: moderateScale(FontSize.xs), // 13 -> xs/sm? xs=12, sm=14. 13 is between. Let's use xs (12) scaling up slightly or sm. Let's use sm for helper text readability or xs if it's meant to be small. 13 is usually small. fontSizes.ts: xs:12, sm:14. I'll use xs for 12/13.
        color: '#888',
        marginTop: verticalScale(5),
    },
    sectionHeader: {
        fontSize: moderateScale(FontSize.lg),
        fontWeight: '700',
        color: '#333',
        marginBottom: verticalScale(15),
    },
    fieldsList: {
        gap: verticalScale(15),
        marginBottom: verticalScale(20),
    },
    readOnlyField: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: moderateScale(12),
        backgroundColor: 'white',
    },
    readOnlyInput: {
        paddingHorizontal: moderateScale(15),
        paddingVertical: verticalScale(14),
        fontSize: moderateScale(FontSize.md),
        color: '#333',
    },
    addQuestionButton: {
        alignSelf: 'stretch',
        paddingVertical: verticalScale(14),
        borderRadius: moderateScale(12),
        borderWidth: 1,
        borderColor: '#FF8A3C',
        borderStyle: 'dashed',
        alignItems: 'center',
        marginTop: verticalScale(20),
        backgroundColor: '#FFF',
    },
    addQuestionText: {
        color: '#FF8A3C',
        fontSize: moderateScale(FontSize.md),
        fontWeight: '700',
    },
    footerButtons: {
        flexDirection: 'row',
        padding: moderateScale(20),
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        gap: moderateScale(15),
        backgroundColor: 'white',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: verticalScale(15),
        borderRadius: moderateScale(10),
        borderWidth: 1,
        borderColor: '#FF8A3C',
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#FF8A3C',
        fontSize: moderateScale(FontSize.md),
        fontWeight: '600',
    },
    saveFooterButton: {
        flex: 1,
        backgroundColor: '#FF8A3C',
        borderRadius: moderateScale(10),
        paddingVertical: verticalScale(15),
        alignItems: 'center',
    },
    saveFooterButtonText: {
        color: 'white',
        fontSize: moderateScale(FontSize.md),
        fontWeight: '600',
    },
    // Action Icons Styles
    customFieldRow: {
        borderWidth: 0,
        backgroundColor: 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        gap: moderateScale(15),
    },
    actionIconsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: moderateScale(15),
    },
    actionIcon: {
        padding: moderateScale(5),
    },
    addQuestionCard: {
        backgroundColor: 'white',
        borderRadius: moderateScale(12),
        padding: moderateScale(20),
        marginTop: verticalScale(15),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: verticalScale(2) },
        shadowOpacity: 0.1,
        shadowRadius: moderateScale(4),
        elevation: 3,
        borderWidth: 0,
    },
    dropdownList: {
        backgroundColor: 'white',
        borderRadius: moderateScale(8),
        marginTop: verticalScale(5),
        elevation: 5,
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        zIndex: 3000,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: verticalScale(2) },
        shadowOpacity: 0.1,
        shadowRadius: moderateScale(4),
    },
    dropdownItem: {
        paddingVertical: verticalScale(14),
        paddingHorizontal: moderateScale(15),
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    dropdownText: {
        fontSize: moderateScale(FontSize.md), // 15 -> md (16)
        color: '#333',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: verticalScale(25),
        gap: moderateScale(15),
    },
    modalCancelButton: {
        paddingVertical: verticalScale(8),
        paddingHorizontal: moderateScale(15),
    },
    modalCancelText: {
        color: '#888',
        fontSize: moderateScale(FontSize.md), // 15 -> md
        fontWeight: '500',
    },
    modalAddButton: {
        backgroundColor: '#FF8A3C',
        paddingVertical: verticalScale(10),
        paddingHorizontal: moderateScale(25),
        borderRadius: moderateScale(8),
        shadowColor: "#FF8A3C",
        shadowOffset: { width: 0, height: verticalScale(2) },
        shadowOpacity: 0.2,
        shadowRadius: moderateScale(3),
        elevation: 2,
    },
    modalAddText: {
        color: 'white',
        fontWeight: '600',
        fontSize: moderateScale(FontSize.md),
    },
    summarySection: {
        marginTop: verticalScale(25),
        gap: verticalScale(15),
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    summaryLabel: {
        fontSize: moderateScale(FontSize.md), // 15 -> md
        fontWeight: '700', // bold label
        color: '#000',
    },
    summaryValue: {
        fontWeight: '400',
        color: '#333',
    },
    // New Styles for Rich Preview
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: verticalScale(10),
        marginBottom: verticalScale(10),
    },
    fieldContainer: {
        marginBottom: verticalScale(20),
    },
    optionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: moderateScale(15),
        marginTop: verticalScale(5),
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: verticalScale(5),
    },
    radioCircle: {
        height: moderateScale(20),
        width: moderateScale(20),
        borderRadius: moderateScale(10),
        borderWidth: 2,
        borderColor: '#666',
        marginRight: moderateScale(8),
    },
    checkboxSquare: {
        height: moderateScale(20),
        width: moderateScale(20),
        borderWidth: 2,
        borderColor: '#666',
        borderRadius: moderateScale(4),
        marginRight: moderateScale(8),
    },
    optionText: {
        fontSize: moderateScale(FontSize.md),
        color: '#333',
    },
    fileUploadBox: {
        height: verticalScale(120),
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: moderateScale(8),
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: verticalScale(5),
        // Minimal shadow
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: verticalScale(1),
        },
        shadowOpacity: 0.1,
        shadowRadius: moderateScale(2),
        elevation: 2,
    },
});
