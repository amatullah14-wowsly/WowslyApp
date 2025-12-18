import React, { useState, useEffect } from 'react'
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Platform, KeyboardAvoidingView, Switch, Modal, Image, Alert } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../../components/BackButton';
import PencilIcon from '../../components/Icons/PencilIcon';
import ChevronDownIcon from '../../components/Icons/ChevronDownIcon';
import { insertOrUpdateRegistrationForm, deleteRegistrationFormFields, getRegistrationFormDetails, getEventDetails } from '../../api/event';
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

const RegistrationFormEditor = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { eventId } = route.params || {};

    // Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
    const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

    // Option State for Multiple Choice
    const [currentOption, setCurrentOption] = useState('');
    const [newQuestionOptions, setNewQuestionOptions] = useState<string[]>([]);

    // Form Configuration State
    const [formId, setFormId] = useState<number | null>(null);
    const [formTitle, setFormTitle] = useState('Guest Registration Form');
    const [buttonText, setButtonText] = useState('Registration');
    const [successMessage, setSuccessMessage] = useState('You have successfully registered for this event!!');
    const [emailValidation, setEmailValidation] = useState(false);

    // Fields State
    const [formFields, setFormFields] = useState<FormField[]>([
        { id: '1', label: 'Name', placeholder: 'Name', type: 'text', isDefault: true, mandatory: 1, is_show: 1 },
        { id: '2', label: 'Country Code', placeholder: 'Country Code', type: 'number', isDefault: true, mandatory: 1, is_show: 1 },
        { id: '3', label: 'Mobile Number', placeholder: 'Mobile Number', type: 'text', isDefault: true, mandatory: 1, is_show: 1 },
        { id: '4', label: 'Email', placeholder: 'Email', type: 'text', isDefault: true, mandatory: 1, is_show: 1 },
    ]);

    const [deletedFieldIds, setDeletedFieldIds] = useState<number[]>([]);

    const [newQuestionType, setNewQuestionType] = useState('Short Answer');
    const [newQuestionLabel, setNewQuestionLabel] = useState('');
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);

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

            // First check if form exists in event details
            const eventRes = await getEventDetails(eventId);
            if (eventRes && eventRes.data) {
                const regFormId = eventRes.data.registration_form_id;

                if (regFormId) {
                    setFormId(regFormId);
                    const formRes = await getRegistrationFormDetails(eventId, regFormId);
                    if (formRes && formRes.data) {
                        const data = formRes.data;
                        setFormTitle(data.title || 'Guest Registration Form');
                        setButtonText(data.form_button_title || 'Registration');
                        setSuccessMessage(data.form_registration_success_message || 'You have successfully registered for this event!!');
                        setEmailValidation(data.email_validation_required === 1);

                        // Map Fields
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
        };
        fetchForm();
    }, [eventId]);

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
            is_show: 1,
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

        const currentFormId = formId || 0;
        const response = await insertOrUpdateRegistrationForm(eventId, currentFormId, payload);

        if (response && response.data) {
            const successMsg = currentFormId === 0 ? "Form Created Successfully" : "Form Saved";
            if (!fromAutosave) Toast.show({ type: 'success', text1: successMsg });

            if (!formId && response.data.id) {
                setFormId(response.data.id);
            }
            // Refresh fields to get new IDs
            if (response.data.fields) {
                const refreshedFields = response.data.fields.map((f: any) => ({
                    id: String(f.id),
                    label: f.question,
                    placeholder: f.question,
                    type: f.type,
                    isDefault: f.id <= 7531 || ['Name', 'Country Code', 'Mobile Number', 'Email'].includes(f.question),
                    mandatory: f.mandatory,
                    is_show: f.is_show,
                    options: f.options
                }));
                // Only update if we are not in the middle of typing? 
                // Wait, if we autosave on Add Question, we should update ID.
                setFormFields(refreshedFields);
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
        setNewQuestionOptions([]);
        setCurrentOption('');
        setShowTypeDropdown(false);
        setEditingFieldId(null);
    }

    const handleAddOption = () => {
        if (currentOption.trim()) {
            setNewQuestionOptions([...newQuestionOptions, currentOption.trim()]);
            setCurrentOption('');
        }
    };

    const handleRemoveOption = (index: number) => {
        setNewQuestionOptions(prev => prev.filter((_, i) => i !== index));
    };

    const confirmAddQuestion = () => {
        if (!newQuestionLabel.trim()) return;

        if (newQuestionType === 'Long Answer') apiType = 'textarea';
        else if (newQuestionType === 'Yes/No Answer') apiType = 'switch';
        else if (newQuestionType === 'Multiple Choice, Single Answer') apiType = 'radio';
        else if (newQuestionType === 'Multiple Choice, Multiple Answer') apiType = 'checkbox';
        else if (newQuestionType === 'File Upload') apiType = 'file';
        else if (newQuestionType === 'Mobile Number' || newQuestionType === 'Country Code') apiType = 'number';

        // Handle Options
        let finalOptions = newQuestionOptions;
        // Switch doesn't strictly need options if backend handles it, but user might want to see them?
        // Usually switch implies boolean/toggle. The log showed options: [] for switch.
        // So we keep options empty for switch unless required.
        if (newQuestionType === 'Yes/No Answer') {
            finalOptions = [];
        }

        const fieldData = {
            label: newQuestionLabel,
            placeholder: newQuestionLabel,
            type: apiType,
            options: finalOptions
        };

        if (editingFieldId) {
            // Update existing field
            const updatedFields = formFields.map(f => {
                if (f.id === editingFieldId) {
                    return {
                        ...f,
                        ...fieldData,
                        // Keep other props
                    };
                }
                return f;
            });
            setFormFields(updatedFields);
            setEditingFieldId(null);
            setNewQuestionLabel('');
            setNewQuestionOptions([]);
            setCurrentOption('');
            setShowAddQuestionModal(false);
            handleSave(true, updatedFields);
        } else {
            // Add new field
            const newField: FormField = {
                id: Date.now().toString(),
                ...fieldData,
                isDefault: false,
                mandatory: 0,
                is_show: 1,
            };

            const updatedFields = [...formFields, newField];
            setFormFields(updatedFields);
            setNewQuestionLabel('');
            setNewQuestionOptions([]);
            setCurrentOption('');
            setShowAddQuestionModal(false);

            // Trigger Autosave with new fields
            handleSave(true, updatedFields);
        }
    };

    const handleEditQuestion = (field: FormField) => {
        setEditingFieldId(field.id);
        setNewQuestionLabel(field.label);

        // Reverse Map API type to UI type
        let uiType = 'Short Answer';
        if (field.type === 'textarea') uiType = 'Long Answer';
        else if (field.type === 'switch') uiType = 'Yes/No Answer';
        else if (field.type === 'radio') uiType = 'Multiple Choice, Single Answer';
        else if (field.type === 'checkbox') uiType = 'Multiple Choice, Multiple Answer';
        else if (field.type === 'file') uiType = 'File Upload';
        else if (field.type === 'number') uiType = 'Mobile Number';

        setNewQuestionType(uiType);
        setNewQuestionOptions(field.options || []);
        setShowAddQuestionModal(true);
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
                            // User said: "delete thai che to toast api devanu" -> Call API NOW?
                            // Payload: {form_field_ids: [id]}
                            const deletePayload = { form_field_ids: [Number(id)] };
                            const deleteRes = await deleteRegistrationFormFields(eventId, deletePayload);
                            if (deleteRes && deleteRes.data) {
                                Toast.show({ type: 'success', text1: 'Question deleted' });
                            }
                        }

                        setFormFields(prev => prev.filter(f => f.id !== id));
                        // Autosave to update 'fields' list (remove from list)
                        setTimeout(() => handleSave(true), 100);
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

    const renderPreviewMode = () => (
        <View style={{ flex: 1 }}>
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.headerTitle}>{formTitle}</Text>
                <TouchableOpacity style={styles.editIconContainer} onPress={() => setIsEditing(true)}>
                    <PencilIcon width={22} height={22} color="#1a237e" />
                </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>{formTitle}</Text>
                    </View>
                    <View style={styles.fieldsContainer}>
                        {formFields.map((field) => (
                            <View key={field.id} style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    value={field.label}
                                    onChangeText={(text) => handleFieldChange(text, field.id)}
                                    placeholder={field.placeholder || field.label}
                                    placeholderTextColor="#999"
                                    editable={false} // Preview is read-only for structure
                                />
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </View>
    );

    const renderEditMode = () => (
        <View style={{ flex: 1 }}>
            <View style={styles.header}>
                <BackButton onPress={() => setIsEditing(false)} />
                {/* Back acts as Cancel/Back to Preview? Or explicit Cancel button? User said 'Cancel' button exists. */}
                <Text style={styles.headerTitle}>Edit Form</Text>
                <View style={{ width: 40 }} />
            </View>
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
                                <View style={{ flex: 1 }}>
                                    {isEditing && !field.isDefault ? (
                                        <TextInput
                                            style={[styles.readOnlyInput, { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, color: '#333' }]}
                                            value={field.label}
                                            editable={false}
                                        />
                                    ) : (
                                        <>
                                            {/* Question Label */}
                                            <View style={{ marginBottom: 5 }}>
                                                <Text style={{ fontSize: 13, color: '#666' }}>{field.label}</Text>
                                            </View>

                                            {/* Render Input based on Type */}
                                            {field.type === 'textarea' ? (
                                                <TextInput
                                                    style={[styles.readOnlyInput, { height: 80, textAlignVertical: 'top' }, !field.isDefault && { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8 }]}
                                                    editable={false}
                                                    multiline
                                                />
                                            ) : field.type === 'switch' ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', height: 40 }}>
                                                    <Switch value={false} disabled={true} trackColor={{ false: "#767577", true: "#FF8A3C" }} />
                                                </View>
                                            ) : (field.type === 'radio' || field.type === 'checkbox') ? (
                                                <View style={{ gap: 5 }}>
                                                    {field.options && field.options.map((opt: string, idx: number) => (
                                                        <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                            <View style={{
                                                                width: 16, height: 16,
                                                                borderRadius: field.type === 'radio' ? 8 : 4,
                                                                borderWidth: 1, borderColor: '#999'
                                                            }} />
                                                            <Text style={{ color: '#333' }}>{opt}</Text>
                                                        </View>
                                                    ))}
                                                    {(!field.options || field.options.length === 0) && <Text style={{ color: '#999', fontStyle: 'italic' }}>No options added</Text>}
                                                </View>
                                            ) : (
                                                <TextInput
                                                    style={[styles.readOnlyInput, !field.isDefault && { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8 }]}
                                                    editable={false}
                                                />
                                            )}
                                        </>
                                    )}
                                </View>
                                {!field.isDefault && isEditing && (
                                    <View style={styles.actionIconsRow}>
                                        <TouchableOpacity style={styles.actionIcon} onPress={() => handleEditQuestion(field)}>
                                            <Image source={require('../../assets/img/form/edit.png')} style={{ width: 20, height: 20, resizeMode: 'contain' }} />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.actionIcon} onPress={() => handleToggleVisibility(field.id)}>
                                            <Image source={require('../../assets/img/form/visible.png')} style={{ width: 22, height: 22, resizeMode: 'contain', opacity: field.is_show ? 1 : 0.3 }} />
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
                                {(newQuestionType.includes('Multiple Choice')) && (
                                    <View style={[styles.inputContainer, { zIndex: 100 }]}>
                                        <Text style={{ fontSize: 13, color: '#666', marginBottom: 5, fontWeight: '500' }}>Add option</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <TextInput
                                                style={[styles.textInput, { flex: 1, borderColor: '#FF8A3C', borderWidth: 1.5 }]}
                                                value={currentOption}
                                                onChangeText={setCurrentOption}
                                                placeholder=""
                                            />
                                            <TouchableOpacity onPress={handleAddOption}>
                                                <Text style={{ fontSize: 30, color: '#FF8A3C', fontWeight: '400' }}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                                            {newQuestionOptions.map((opt, index) => (
                                                <TouchableOpacity key={index} style={styles.optionPill} onPress={() => handleRemoveOption(index)}>
                                                    <Text style={styles.optionPillText}>{opt}</Text>
                                                    <View style={styles.optionPillClose}><Text style={{ color: '#FF8A3C', fontSize: 10, fontWeight: 'bold' }}>✕</Text></View>
                                                </TouchableOpacity>
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
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveFooterButton} onPress={() => handleSave(false)}>
                    <Text style={styles.saveFooterButtonText}>{formId ? 'Save' : 'Create Form'}</Text>
                </TouchableOpacity>
            </View>
        </View >
    );

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                {isEditing ? renderEditMode() : renderPreviewMode()}
            </KeyboardAvoidingView>


        </SafeAreaView>
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
    optionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF8A3C',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        gap: 8,
    },
    optionPillText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    optionPillClose: {
        backgroundColor: 'white',
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    }
})
