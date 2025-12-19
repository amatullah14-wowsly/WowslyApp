import React, { useState, useEffect } from 'react'
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Platform, KeyboardAvoidingView, Switch, Modal, Image, Alert } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../../components/BackButton';
import PencilIcon from '../../components/Icons/PencilIcon';
import ChevronDownIcon from '../../components/Icons/ChevronDownIcon';
import { insertOrUpdateRegistrationForm, deleteRegistrationFormFields, getRegistrationFormDetails, getEventDetails, getRegistrationFormStatus, createRegistrationForm } from '../../api/event';
import Toast from 'react-native-toast-message';

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
        { id: 'default_2', label: 'Country Code', placeholder: 'Country Code', type: 'number', isDefault: true, mandatory: 1, is_show: 1 },
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
                    { id: 'default_2', label: 'Country Code', placeholder: 'Country Code', type: 'number', isDefault: true, mandatory: 1, is_show: 1 },
                    { id: 'default_3', label: 'Mobile Number', placeholder: 'Mobile Number', type: 'text', isDefault: true, mandatory: 1, is_show: 1 },
                    { id: 'default_4', label: 'Email', placeholder: 'Email', type: 'text', isDefault: true, mandatory: 1, is_show: 1 },
                ]);
                setFormId(null);
                setFormTitle('Guest Registration Form');
                setIsEditing(true);
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
        // Common Label
        const Label = () => <Text style={{ fontSize: 15, color: '#333', marginBottom: 8 }}>{field.label}</Text>;

        switch (field.type) {
            case 'switch':
                return (
                    <View style={styles.switchRow}>
                        <Text style={{ fontSize: 16, color: '#333' }}>{field.label}</Text>
                        <Switch
                            trackColor={{ false: "#767577", true: "#d3d3d3" }} // Greyish for read-only preview or match screenshot
                            thumbColor={Platform.OS === 'ios' ? '#fff' : '#f4f3f4'}
                            value={false} // Default off for preview or mock
                            disabled={true}
                        />
                    </View>
                );
            case 'radio':
                return (
                    <View style={styles.fieldContainer}>
                        <Label />
                        <View style={styles.optionsRow}>
                            {field.options && field.options.map((opt, idx) => (
                                <View key={idx} style={styles.optionItem}>
                                    <View style={styles.radioCircle} />
                                    <Text style={styles.optionText}>{opt}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                );
            case 'checkbox':
                return (
                    <View style={styles.fieldContainer}>
                        <Label />
                        <View style={styles.optionsRow}>
                            {field.options && field.options.map((opt, idx) => (
                                <View key={idx} style={styles.optionItem}>
                                    <View style={styles.checkboxSquare} />
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
                        <View style={styles.fileUploadBox}>
                            <Text style={{ color: '#666', marginBottom: 5 }}>{field.label}</Text>
                            {/* Replaced missing image with text placeholder */}
                            <View style={{ width: 40, height: 40, borderWidth: 1, borderColor: '#999', justifyContent: 'center', alignItems: 'center', borderRadius: 4 }}>
                                <Text style={{ fontSize: 24, color: '#999', lineHeight: 28 }}>↑</Text>
                            </View>
                            <Text style={{ fontSize: 10, color: '#999', marginTop: 4 }}>Upload File</Text>
                        </View>
                    </View>
                );
            case 'textarea':
                return (
                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                            value={field.label === "Address" ? "" : field.label} // Don't show label as value for address if empty 
                            placeholder={field.placeholder}
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
                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={[styles.input, field.isDefault && { borderBottomWidth: 1, borderBottomColor: '#FF8A3C' }]}
                            value={field.isDefault ? field.label : ""}
                            onChangeText={field.isDefault ? (text) => handleFieldChange(text, field.id) : undefined}
                            placeholder={field.label + (field.mandatory ? " *" : "")}
                            placeholderTextColor={field.isDefault ? "#333" : "#666"}
                            editable={field.isDefault}
                        />
                    </View>
                );
        }
    };

    const renderPreviewMode = () => (
        <View style={{ flex: 1 }}>
            {!isEmbedded && (
                <View style={styles.header}>
                    <BackButton onPress={() => navigation.goBack()} />
                    <Text style={styles.headerTitle}>{!formId ? "Create Registration Form" : formTitle}</Text>
                    <View style={{ width: 22 }} />
                </View>
            )}
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Form Details</Text>
                        <TouchableOpacity
                            style={styles.editIconContainer}
                            onPress={() => {
                                if (isEmbedded) {
                                    navigation.navigate('RegistrationFormEditor', { eventId, autoEdit: true });
                                } else {
                                    setIsEditing(true);
                                }
                            }}
                        >
                            <PencilIcon width={20} height={20} color="#1a237e" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.fieldsContainer}>
                        {formFields.filter(f => f.is_show !== 0 && f.is_show !== false).map((field) => (
                            <View key={field.id}>
                                {renderFieldPreview(field)}
                            </View>
                        ))}
                    </View>

                    {/* Summary Section */}
                    <View style={styles.summarySection}>
                        <Text style={styles.summaryLabel}>Button Text : <Text style={styles.summaryValue}>{buttonText}</Text></Text>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Registration success message : </Text>
                            <Text style={[styles.summaryValue, { flex: 1 }]}>{successMessage}</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );

    const renderEditMode = () => (
        <View style={{ flex: 1 }}>
            {!isEmbedded && (
                <View style={styles.header}>
                    <BackButton onPress={() => setIsEditing(false)} />
                    {/* Back acts as Cancel/Back to Preview? Or explicit Cancel button? User said 'Cancel' button exists. */}
                    <Text style={styles.headerTitle}>Edit Form</Text>
                    <View style={{ width: 40 }} />
                </View>
            )}
            <ScrollView contentContainerStyle={styles.content}>
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
                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Email Validation</Text>
                        <Switch
                            trackColor={{ false: "#767577", true: "#FF8A3C" }}
                            thumbColor={emailValidation ? "#f4f3f4" : "#f4f3f4"}
                            onValueChange={setEmailValidation}
                            value={emailValidation}
                        />
                    </View>
                    <Text style={styles.helperText}>Mark as mandatory fields by clicking on the check boxes</Text>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionHeader}>Form Details</Text>
                    <View style={styles.fieldsList}>
                        {formFields.map((field) => (
                            <View key={field.id} style={[styles.readOnlyField, !field.isDefault && styles.customFieldRow]}>
                                <TextInput
                                    style={[styles.readOnlyInput, !field.isDefault && { flex: 1, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8 }]}
                                    value={field.label}
                                    placeholder={field.placeholder}
                                    editable={false}
                                />
                                {!field.isDefault && (
                                    <View style={styles.actionIconsRow}>
                                        <TouchableOpacity style={styles.actionIcon} onPress={() => handleEditQuestion(field)}>
                                            <Image source={require('../../assets/img/form/edit.png')} style={{ width: 20, height: 20, resizeMode: 'contain' }} />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.actionIcon} onPress={() => handleToggleVisibility(field.id)}>
                                            <Image
                                                source={field.is_show ? require('../../assets/img/form/visible.png') : require('../../assets/img/form/hide.png')}
                                                style={{ width: 22, height: 22, resizeMode: 'contain', opacity: field.is_show ? 1 : 0.6 }}
                                            />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.actionIcon} onPress={() => handleDeleteField(field.id)}>
                                            <Image source={require('../../assets/img/form/trash.png')} style={{ width: 20, height: 20, resizeMode: 'contain' }} />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                    {
                        showAddQuestionModal ? (
                            <View style={styles.addQuestionCard} >
                                {/* Title Removed as requested */}

                                {/* Question Type Selector */}
                                <View style={[styles.inputContainer, { zIndex: 2000 }]} >
                                    <Text style={{ fontSize: 13, color: '#666', marginBottom: 5, fontWeight: '500' }}>Question Type</Text>
                                    <TouchableOpacity
                                        style={[styles.textInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                                        onPress={() => setShowTypeDropdown(!showTypeDropdown)}
                                    >
                                        <Text style={{ color: '#333' }}>{newQuestionType}</Text>
                                        <ChevronDownIcon width={20} height={20} color="#666" />
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
                                        <View style={[styles.inputContainer, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                                            <TextInput
                                                style={[styles.textInput, { flex: 1 }]}
                                                placeholder="Add option"
                                                placeholderTextColor="#999"
                                                value={newOptionText}
                                                onChangeText={setNewOptionText}
                                            />
                                            <TouchableOpacity onPress={handleAddOption}>
                                                <Text style={{ fontSize: 30, color: '#FF8A3C', fontWeight: '500' }}>+</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Chips */}
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5, marginBottom: 15 }}>
                                            {newOptions.map((opt, idx) => (
                                                <View key={idx} style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    backgroundColor: '#FF8A3C',
                                                    borderRadius: 20,
                                                    paddingHorizontal: 15,
                                                    paddingVertical: 8,
                                                    gap: 8
                                                }}>
                                                    <Text style={{ color: 'white', fontSize: 14 }}>{opt}</Text>
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
                                <Text style={styles.addQuestionText}>+ Add Question</Text>
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
        </View >
    );

    // Wrapper Logic for Embedded Mode
    const Wrapper = isEmbedded ? View : SafeAreaView;
    const wrapperStyle = isEmbedded ? { flex: 1, backgroundColor: '#fff' } : styles.container;

    return (
        <Wrapper style={wrapperStyle}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                {isEditing ? renderEditMode() : renderPreviewMode()}
            </KeyboardAvoidingView>
        </Wrapper>
    )
}

export default RegistrationFormEditor

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 40,
        paddingBottom: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    editIconContainer: {
        padding: 5,
    },
    content: {
        padding: 20,
        paddingBottom: 100,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        marginBottom: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    fieldsContainer: {
        gap: 15,
    },
    inputWrapper: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        backgroundColor: 'white',
    },
    input: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 15,
        color: '#333',
    },
    // Settings Styles
    sectionContainer: {
        marginBottom: 30,
    },
    inputContainer: {
        marginBottom: 20,
        position: 'relative',
    },
    inputLabel: {
        position: 'absolute',
        top: -10,
        left: 10,
        backgroundColor: 'white',
        paddingHorizontal: 5,
        fontSize: 12,
        color: '#666',
        zIndex: 1,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 16,
        color: '#333',
        backgroundColor: 'white',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        gap: 15,
    },
    toggleLabel: {
        fontSize: 16,
        color: '#333',
    },
    helperText: {
        fontSize: 13,
        color: '#888',
        marginTop: 5,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
        marginBottom: 15,
    },
    fieldsList: {
        gap: 15,
        marginBottom: 20,
    },
    readOnlyField: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        backgroundColor: 'white',
    },
    readOnlyInput: {
        paddingHorizontal: 15,
        paddingVertical: 14,
        fontSize: 16,
        color: '#333',
    },
    addQuestionButton: {
        alignSelf: 'center',
        paddingVertical: 10,
    },
    addQuestionText: {
        color: '#FF8A3C',
        fontSize: 16,
        fontWeight: '600',
    },
    footerButtons: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        gap: 15,
        backgroundColor: 'white',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FF8A3C',
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#FF8A3C',
        fontSize: 16,
        fontWeight: '600',
    },
    saveFooterButton: {
        flex: 1,
        backgroundColor: '#FF8A3C',
        borderRadius: 10,
        paddingVertical: 15,
        alignItems: 'center',
    },
    saveFooterButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    // Action Icons Styles
    customFieldRow: {
        borderWidth: 0,
        backgroundColor: 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    actionIconsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    actionIcon: {
        padding: 5,
    },
    addQuestionCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        marginTop: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 0,
    },
    dropdownList: {
        backgroundColor: 'white',
        borderRadius: 8,
        marginTop: 5,
        elevation: 5,
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        zIndex: 3000,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    dropdownItem: {
        paddingVertical: 14,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    dropdownText: {
        fontSize: 15,
        color: '#333',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 25,
        gap: 15,
    },
    modalCancelButton: {
        paddingVertical: 8,
        paddingHorizontal: 15,
    },
    modalCancelText: {
        color: '#888',
        fontSize: 15,
        fontWeight: '500',
    },
    modalAddButton: {
        backgroundColor: '#FF8A3C',
        paddingVertical: 10,
        paddingHorizontal: 25,
        borderRadius: 8,
        shadowColor: "#FF8A3C",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 2,
    },
    modalAddText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 15,
    },
    summarySection: {
        marginTop: 25,
        gap: 15,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    summaryLabel: {
        fontSize: 15,
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
        paddingVertical: 10,
        marginBottom: 10,
    },
    fieldContainer: {
        marginBottom: 20,
    },
    optionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 15,
        marginTop: 5,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    radioCircle: {
        height: 20,
        width: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#666',
        marginRight: 8,
    },
    checkboxSquare: {
        height: 20,
        width: 20,
        borderWidth: 2,
        borderColor: '#666',
        borderRadius: 4,
        marginRight: 8,
    },
    optionText: {
        fontSize: 15,
        color: '#333',
    },
    fileUploadBox: {
        height: 120,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 5,
        // Minimal shadow
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
})
