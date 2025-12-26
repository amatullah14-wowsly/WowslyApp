import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, Image, Switch, Alert, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { scale, verticalScale, moderateScale } from '../../utils/scaling';
import { getEventTickets, getRegistrationFormStatus, getRegistrationFormDetails, submitGuestRegistrationForm } from '../../api/event';
import Toast from 'react-native-toast-message';
import BackButton from '../../components/BackButton';
import DocumentPicker from 'react-native-document-picker';

const GuestRegistration = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { eventId, registeredBy } = route.params || {};

    const [loading, setLoading] = useState(false);
    const [tickets, setTickets] = useState<any[]>([]);
    const [selectedTicketId, setSelectedTicketId] = useState<number | string | null>(null);
    const [formFields, setFormFields] = useState<any[]>([]);
    const [formValues, setFormValues] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<Record<string, string>>({}); // Validation errors
    const [formTitle, setFormTitle] = useState('Guest Registration Form');
    const [buttonText, setButtonText] = useState('Registration');

    useEffect(() => {
        if (eventId) {
            fetchData();
        }
    }, [eventId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Tickets
            const ticketsRes = await getEventTickets(eventId, { include_hidden_tickets: 0 });
            if (ticketsRes && ticketsRes.data) {
                setTickets(ticketsRes.data);
                if (ticketsRes.data.length > 0) {
                    setSelectedTicketId(ticketsRes.data[0].id);
                }
            }

            // 2. Fetch Form
            const statusRes = await getRegistrationFormStatus(eventId);
            let activeForm = null;

            if (statusRes?.is_filled && statusRes.form?.length > 0) {
                activeForm = statusRes.form[0];
            } else if (statusRes?.form?.length > 0) {
                activeForm = statusRes.form[0];
            } else if (statusRes?.data?.id) {
                activeForm = statusRes.data;
            }

            if (activeForm) {
                setFormTitle(activeForm.title || 'Guest Registration Form');
                setButtonText(activeForm.form_button_title || 'Registration');

                if (activeForm.fields) {
                    setFormFields(activeForm.fields);
                    initializeFormValues(activeForm.fields);
                } else {
                    const detailsRes = await getRegistrationFormDetails(eventId, activeForm.id);
                    if (detailsRes?.data?.fields) {
                        setFormFields(detailsRes.data.fields);
                        initializeFormValues(detailsRes.data.fields);
                        setFormTitle(detailsRes.data.title || formTitle);
                    }
                }
            } else {
                // Default fields if no form configuration found
                const defaults = [
                    { id: 'default_1', question: 'Name', type: 'text', mandatory: 1, is_show: 1, options: [] },
                    { id: 'default_2', question: 'Country Code', type: 'number', mandatory: 1, is_show: 1, options: [] },
                    { id: 'default_3', question: 'Mobile Number', type: 'text', mandatory: 1, is_show: 1, options: [] },
                    { id: 'default_4', question: 'Email', type: 'text', mandatory: 1, is_show: 1, options: [] },
                ];
                setFormFields(defaults);
                initializeFormValues(defaults);
            }

        } catch (error) {
            console.error("Error fetching guest registration data:", error);
            Toast.show({ type: 'error', text1: 'Error loading details' });
        } finally {
            setLoading(false);
        }
    };

    const initializeFormValues = (fields: any[]) => {
        const initial: Record<string, any> = {};
        fields.forEach((f: any) => {
            initial[f.id] = "";
        });
        setFormValues(initial);
    };

    const handleInputChange = (fieldId: string | number, value: any, isMultiSelect: boolean = false) => {
        setFormValues(prev => {
            if (isMultiSelect) {
                const current = Array.isArray(prev[fieldId]) ? prev[fieldId] : (prev[fieldId] ? [prev[fieldId]] : []);
                const exists = current.includes(value);
                let newArr;
                if (exists) {
                    newArr = current.filter((item: any) => item !== value);
                } else {
                    newArr = [...current, value];
                }
                return { ...prev, [fieldId]: newArr };
            }
            return { ...prev, [fieldId]: value };
        });

        // Clear error
        if (errors[fieldId]) {
            setErrors(prev => {
                const newErrs = { ...prev };
                delete newErrs[fieldId];
                return newErrs;
            });
        }
    };

    const handleFilePick = async (fieldId: string | number) => {
        try {
            const res = await DocumentPicker.pickSingle({
                type: [DocumentPicker.types.allFiles],
            });
            // res contains uri, type, name, size
            handleInputChange(fieldId, res);
        } catch (err) {
            if (DocumentPicker.isCancel(err)) {
                // User cancelled
            } else {
                console.error("File pick error", err);
                Alert.alert("Error", "Failed to pick file");
            }
        }
    };

    const validateForm = () => {
        let newErrors: Record<string, string> = {};
        let isValid = true;

        formFields.forEach(field => {
            if (field.is_show) {
                // 1. Mandatory Check
                const isSwitch = field.type === 'switch' || field.type === 'Yes/No Answer';
                const val = formValues[field.id];

                if (!isSwitch) {
                    // Check if empty string or empty array or null/undefined
                    const isEmpty = !val || (Array.isArray(val) && val.length === 0);

                    // Special check for mandatory
                    if (field.mandatory && isEmpty) {
                        newErrors[field.id] = "This field is required";
                        isValid = false;
                    }
                }

                // 2. Mobile Validation
                // ... (existing logic, val might be array? no mobile is text)
                if (field.type !== 'file' && field.question && field.question.toLowerCase().includes('mobile')) {
                    const v = typeof val === 'string' ? val : "";
                    if (v) {
                        const numericVal = v.replace(/[^0-9]/g, '');
                        if (numericVal.length > 10) {
                            newErrors[field.id] = "Mobile number cannot be more than 10 digits";
                            isValid = false;
                        } else if (numericVal.length < 10) {
                            newErrors[field.id] = "Mobile number must be 10 digits";
                            isValid = false;
                        }
                    }
                }
            }
        });
        setErrors(newErrors);
        return isValid;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            Alert.alert("Validation Error", "Please correct the errors in the form.");
            return;
        }

        if (!selectedTicketId) {
            // Logic handled above (auto-select or warn)
        }

        // Prepare FormData Payload
        const formData = new FormData();

        // Add QAs
        formFields.forEach((field, index) => {
            let answer = formValues[field.id];

            // Checkbox/Multi handling
            if (Array.isArray(answer)) {
                answer = answer.join(',');
            }

            formData.append(`QAs[${index}][question_id]`, field.id);

            // File handling
            if (typeof answer === 'object' && answer !== null && answer.uri) {
                formData.append(`QAs[${index}][answer]`, {
                    uri: answer.uri,
                    type: answer.type || 'application/octet-stream',
                    name: answer.name || `file_${field.id}`
                });
                // Some backends might need specific key for file?
                // Usually 'answer' is fine if the backend handles it polymorphically 
                // OR if the input type in backend expects a file. 
                // Given "QAs[0][answer]" is the key, we stick to it.
            } else {
                formData.append(`QAs[${index}][answer]`, answer || "");
            }
        });

        // Extract Dialing Code and Mobile
        const countryCodeField = formFields.find(f => f.question?.toLowerCase().includes('country code'));
        const mobileField = formFields.find(f => f.question?.toLowerCase().includes('mobile'));
        const countryCode = countryCodeField ? formValues[countryCodeField.id] : "";
        const mobile = mobileField ? formValues[mobileField.id] : "";

        formData.append('dialing_code', countryCode);
        formData.append('mobile', mobile);
        formData.append('registered_by', ""); // Empty string or null
        // formData.append('ticket_id', selectedTicketId); // Ensure string/number
        // formData.append('quantity', 1);

        if (selectedTicketId) {
            formData.append('ticket_id', selectedTicketId);
            formData.append('quantity', 1);
        }

        setLoading(true);
        // Important: When sending FormData, header 'Content-Type': 'multipart/form-data' is usually needed 
        // but axios often sets it automatically with boundary. 
        // We pass formData as the payload.
        const res = await submitGuestRegistrationForm(eventId, formData);
        setLoading(false);

        if (res && (res.status === true || res.guest_data)) {
            // Extract guest info
            const guestUuid = res.guest_data?.uuid || res.guest_data?.guest_uuid || res.guest_uuid;
            // If unknown structure, might need to debug, but assuming `guest_data` has the needed UUID.

            // Extract Name, Email, Mobile from res.QAs if available, otherwise fallback to formValues
            let guestName = "Guest";
            let guestMobile = "";
            let guestEmail = "";

            // Helper to find answer by question content
            const findAnswer = (qs: string[]) => {
                if (res.QAs && Array.isArray(res.QAs)) {
                    const qa = res.QAs.find((q: any) => qs.some(query => q.question && q.question.toLowerCase().includes(query.toLowerCase())));
                    return qa ? qa.answer : null;
                }
                return null;
            };

            // Helper to find value from formValues as fallback
            const findFormValue = (qs: string[]) => {
                const field = formFields.find(f => qs.some(query => f.question && f.question.toLowerCase().includes(query.toLowerCase())));
                return field ? formValues[field.id] : null;
            }

            guestName = findAnswer(['Name', 'Full Name']) || findFormValue(['Name', 'Full Name']) || "Guest";
            guestMobile = findAnswer(['Mobile', 'Phone']) || findFormValue(['Mobile', 'Phone']) || "";
            guestEmail = findAnswer(['Email']) || findFormValue(['Email']) || "";

            // If mobile/email empty, try top level fields if API returns them differently? 
            // Based on user snippet: res has "QAs" array.

            if (tickets && tickets.length > 0) {
                navigation.navigate("GuestTicketSelection", {
                    eventId,
                    guestUuid: guestUuid,
                    registeredBy: null, // or current user id if needed
                    guestDetails: {
                        name: guestName,
                        mobile: guestMobile,
                        email: guestEmail
                    }
                });
            } else {
                Alert.alert("Success", "Guest Registered Successfully!", [{ text: "OK", onPress: () => navigation.goBack() }]);
            }
        } else {
            Alert.alert("Error", res?.message || "Registration failed");
        }
    };

    const renderField = (field: any) => {
        if (!field.is_show) return null;

        // Styles matching RegistrationFormEditor's renderFieldPreview
        // Changed: Always show * as all fields are now mandatory
        const Label = () => (
            <Text style={{ fontSize: moderateScale(15), color: '#333', marginBottom: verticalScale(8), fontWeight: '500' }}>
                {field.question} <Text style={{ color: 'red' }}>*</Text>
            </Text>
        );

        const ErrorMsg = () => (
            errors[field.id] ? <Text style={{ color: 'red', fontSize: moderateScale(12), marginTop: 5 }}>{errors[field.id]}</Text> : null
        );

        switch (field.type) {
            case 'switch':
            case 'Yes/No Answer':
                return (
                    <View style={styles.fieldContainer}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: errors[field.id] ? 'red' : '#E0E0E0', borderRadius: 8, padding: 12 }}>
                            <Text style={{ fontSize: moderateScale(16), color: '#333' }}>{field.question}</Text>
                            <Switch
                                trackColor={{ false: "#767577", true: "#FF8A3C" }}
                                thumbColor={formValues[field.id] ? "#white" : "#f4f3f4"}
                                value={formValues[field.id] === 'yes' || formValues[field.id] === true}
                                onValueChange={(val) => handleInputChange(field.id, val ? 'yes' : 'no')}
                            />
                        </View>
                        <ErrorMsg />
                    </View>
                );
            case 'radio':
            case 'Multiple Choice, Single Answer':
                return (
                    <View style={styles.fieldContainer}>
                        <Label />
                        <View style={{ gap: 10 }}>
                            {field.options && field.options.map((opt: any, idx: number) => {
                                const isSelected = formValues[field.id] === opt;
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: isSelected ? '#FF8A3C' : (errors[field.id] ? 'red' : '#E0E0E0'), borderRadius: 8, padding: 12 }}
                                        onPress={() => handleInputChange(field.id, opt)}
                                    >
                                        <View style={{
                                            height: 20,
                                            width: 20,
                                            borderRadius: 10,
                                            borderWidth: 2,
                                            borderColor: isSelected ? '#FF8A3C' : '#666',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginRight: 10
                                        }}>
                                            {isSelected && (
                                                <View style={{
                                                    height: 10,
                                                    width: 10,
                                                    borderRadius: 5,
                                                    backgroundColor: '#FF8A3C',
                                                }} />
                                            )}
                                        </View>
                                        <Text style={styles.optionText}>{opt}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <ErrorMsg />
                    </View>
                );
            case 'checkbox':
            case 'Multiple Choice, Multiple Answer':
                const selected = formValues[field.id] || [];
                return (
                    <View style={styles.fieldContainer}>
                        <Label />
                        <View style={{ gap: 10 }}>
                            {field.options && field.options.map((opt: any, idx: number) => {
                                const isChecked = selected.includes(opt);
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: isChecked ? '#FF8A3C' : (errors[field.id] ? 'red' : '#E0E0E0'), borderRadius: 8, padding: 12 }}
                                        onPress={() => handleInputChange(field.id, opt, true)}
                                    >
                                        <View style={[styles.checkboxSquare, {
                                            borderColor: isChecked ? '#FF8A3C' : '#666',
                                            backgroundColor: isChecked ? '#FF8A3C' : 'transparent',
                                            borderWidth: isChecked ? 0 : 1.5,
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }]}>
                                            {isChecked && <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                                        </View>
                                        <Text style={styles.optionText}>{opt}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <ErrorMsg />
                    </View>
                );
            case 'file':
                const fileVal = formValues[field.id];
                return (
                    <View style={styles.fieldContainer}>
                        <Label />
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: errors[field.id] ? 'red' : '#E0E0E0', borderRadius: 8, padding: 15, borderStyle: 'dashed' }}
                            onPress={() => handleFilePick(field.id)}
                        >
                            <Text style={{ fontSize: 18, color: '#5F6368', marginRight: 10 }}>cloud_upload</Text>
                            <Text style={{ color: '#333', fontSize: 14 }}>
                                {fileVal ? (fileVal.name || "File Selected") : "Upload File"}
                            </Text>
                        </TouchableOpacity>
                        <ErrorMsg />
                    </View>
                );
            case 'textarea':
                return (
                    <View style={styles.fieldContainer}>
                        <Label />
                        <TextInput
                            style={[styles.input, { height: 100, textAlignVertical: 'top', borderColor: errors[field.id] ? 'red' : '#E0E0E0' }]}
                            placeholder={field.question || "Your answer"}
                            placeholderTextColor="#999"
                            multiline={true}
                            value={formValues[field.id]}
                            onChangeText={(t) => handleInputChange(field.id, t)}
                        />
                        <ErrorMsg />
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
                            style={[styles.input, { borderColor: errors[field.id] ? 'red' : '#E0E0E0' }]}
                            placeholder={field.question || "Your answer"}
                            placeholderTextColor="#999"
                            value={formValues[field.id]}
                            onChangeText={(t) => handleInputChange(field.id, t)}
                            keyboardType={field.type === 'number' ? 'numeric' : 'default'} // Basic keyboard type mapping
                        />
                        <ErrorMsg />
                    </View>
                );
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.headerTitle}>Register a Guest</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Ticket Selection - Matching style mostly but ensuring it fits in the 'Form' look */}
                {/* Ticket Selection Removed to match Preview Mode */}
                <View />

                {/* Form Title & Separator - MATCHING PREVIEW UI */}
                <View style={{ marginBottom: 30, marginTop: 10 }}>
                    <Text style={{ fontSize: 24, fontWeight: '700', color: '#000', textAlign: 'center' }}>{formTitle}</Text>
                    <View style={{ height: 2, width: 40, backgroundColor: '#000', marginTop: 10, alignSelf: 'center' }} />
                </View>

                {/* Fields */}
                <View style={{ gap: 20 }}>
                    {formFields.map((field: any) => (
                        <View key={field.id}>
                            {renderField(field)}
                        </View>
                    ))}
                </View>

                {/* Submit Button */}
                <View style={{ marginTop: 40, marginBottom: 40 }}>
                    <TouchableOpacity
                        style={styles.submitButton}
                        onPress={handleSubmit}
                    >
                        <Text style={styles.submitText}>{buttonText}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    header: {
        width: '100%',
        paddingVertical: scale(15),
        backgroundColor: 'white',
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: scale(20),
    },
    headerTitle: {
        fontSize: moderateScale(20),
        fontWeight: '600',
        color: 'black',
        flex: 1,
        textAlign: 'center',
    },
    content: {
        padding: scale(20),
        paddingBottom: verticalScale(100),
    },
    fieldContainer: {
        marginBottom: 0, // Handled by gap in parent
    },
    input: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 16,
        color: '#333',
        backgroundColor: 'white'
    },
    radioCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1.5,
        borderColor: '#666',
        marginRight: 10,
    },
    checkboxSquare: {
        width: 18,
        height: 18,
        borderWidth: 1.5,
        borderColor: '#666',
        marginRight: 10,
    },
    optionText: {
        fontSize: moderateScale(16),
        color: '#333',
    },
    submitButton: {
        backgroundColor: '#FF8A3C',
        borderRadius: 8,
        paddingVertical: 15,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3
    },
    submitText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 18
    },
    ticketScroll: {
        flexGrow: 0,
    },
    ticketCard: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: scale(10),
        padding: scale(12),
        marginRight: scale(10),
        minWidth: scale(100),
        alignItems: 'center',
    },
    ticketCardSelected: {
        backgroundColor: '#FF8A3C',
        borderColor: '#FF8A3C',
    },
    ticketName: {
        fontSize: moderateScale(14),
        fontWeight: '600',
        color: '#333',
        marginBottom: verticalScale(4),
    },
    ticketPrice: {
        fontSize: moderateScale(12),
        color: '#666',
    },
});

export default GuestRegistration;
