import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray, useWatch, Control, UseFormRegister } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { studentSchema, StudentFormData } from '../schemas/studentSchema';
import { Input, Select } from '../components/ui/Form';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import { getCoursesForSemester, getAllCourses, Course } from '../data/syllabus';

export default function StudentForm() {
  const { roll_no } = useParams(); // Using roll_no from URL
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema) as any,
    defaultValues: {
      previous_academics: [],
      extra_curricular: [],
      identification_marks: [],
      counselor_diary: [],
      test_marks: [],
      exam_marks: [],
      contact_info: {},
      family_details: {}
    }
  });

  useEffect(() => {
    if (roll_no) {
      fetch(`/api/students/${roll_no}`)
        .then(res => res.json())
        .then(data => reset(data))
        .catch(err => console.error(err));
    }
  }, [roll_no, reset]);

  const onSubmit: any = async (data: StudentFormData) => {
    setIsSubmitting(true);
    try {
      const url = roll_no ? `/api/students/${roll_no}` : '/api/students';
      const method = roll_no ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (res.ok) {
        navigate('/students');
      } else {
        alert('Failed to save student');
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'contact', label: 'Contact & Family' },
    { id: 'academic', label: 'Academic History' },
    { id: 'tests', label: 'Internal Tests' },
    { id: 'exams', label: 'Semester Exams' },
    { id: 'counselor', label: 'Counselor Diary' },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/students')} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">
            {roll_no ? 'Edit Student' : 'New Student Entry'}
          </h1>
        </div>
        <button
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={20} />
          {isSubmitting ? 'Saving...' : 'Save Record'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap",
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className={clsx(activeTab === 'personal' ? 'block' : 'hidden')}>
          <PersonalInfoSection register={register} errors={errors} control={control} setValue={setValue} watch={watch} />
        </div>
        <div className={clsx(activeTab === 'contact' ? 'block' : 'hidden')}>
          <ContactFamilySection register={register} control={control} />
        </div>
        <div className={clsx(activeTab === 'academic' ? 'block' : 'hidden')}>
          <AcademicHistorySection register={register} control={control} />
        </div>
        <div className={clsx(activeTab === 'tests' ? 'block' : 'hidden')}>
          <TestMarksSection register={register} control={control} setValue={setValue} />
        </div>
        <div className={clsx(activeTab === 'exams' ? 'block' : 'hidden')}>
          <ExamMarksSection register={register} control={control} setValue={setValue} />
        </div>
        <div className={clsx(activeTab === 'counselor' ? 'block' : 'hidden')}>
          <CounselorDiarySection register={register} control={control} />
        </div>
      </form>
    </div>
  );
}

// Sub-components for sections

function PersonalInfoSection({ register, errors, control, setValue, watch }: any) {
  const { fields, append, remove } = useFieldArray({ control, name: "identification_marks" });
  const photo = watch('profile_pic_path') || watch('photo');

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setValue('photo', result);
        setValue('profile_pic_path', result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
        <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
        
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            <div className="w-32 h-32 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative">
              {photo ? (
                <img src={photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-400 text-xs text-center p-2">No Photo</span>
              )}
            </div>
            <label className="cursor-pointer bg-blue-50 text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-100 transition-colors">
              Upload Photo
              <input type="file" className="hidden" accept="image/*" onChange={handlePhotoChange} />
            </label>
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
            <Input label="Name of Student" {...register('name')} error={errors.name?.message} />
            <Input label="Roll No" {...register('roll_no')} error={errors.roll_no?.message} />
            <Input label="KLNCE Reg No" {...register('klnce_reg_no')} />
            <Input label="Batch" {...register('batch')} placeholder="e.g. 2024-2026" />
            <Input label="Date of Birth" type="date" {...register('date_of_birth')} />
            <Select label="Sex" {...register('sex')} options={['Male', 'Female', 'Other']} />
            <Input label="Blood Group" {...register('blood_group')} />
            <Input label="Height (cm)" {...register('height_cm')} />
            <Input label="Weight (kg)" {...register('weight_kg')} />
            <Input label="Admission Date" type="date" {...register('admission_date')} />
            <Input label="UG Background" {...register('ug_background')} placeholder="e.g. BCA, BSc CS" />
            <Input label="UG Percentage" {...register('ug_percentage')} />
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
        <h3 className="text-lg font-semibold border-b pb-2">Identification Marks</h3>
        <div className="space-y-2">
          {fields.map((field: any, index: number) => (
            <div key={field.id} className="flex gap-4 items-center">
              <Input label={`Mark ${index + 1}`} {...register(`identification_marks.${index}.description`)} className="flex-1" />
              <button type="button" onClick={() => remove(index)} className="p-2 text-red-500 hover:bg-red-50 rounded mt-6">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => append({ description: '' })} className="text-sm text-blue-600 flex items-center gap-1">
            <Plus size={16} /> Add Mark
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactFamilySection({ register, control }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
        <h3 className="text-lg font-semibold border-b pb-2">Contact Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input label="Address" {...register('contact_info.address')} className="md:col-span-2" />
          <Input label="City" {...register('contact_info.city')} />
          <Input label="Pincode" {...register('contact_info.pincode')} />
          <Input label="Primary Phone" {...register('contact_info.phone_primary')} />
          <Input label="Secondary Phone" {...register('contact_info.phone_secondary')} />
          <Input label="Email" {...register('contact_info.email')} />
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
        <h3 className="text-lg font-semibold border-b pb-2">Family Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input label="Father's Name" {...register('family_details.father_name')} />
          <Input label="Mother's Name" {...register('family_details.mother_name')} />
          <Input label="Parent Occupation" {...register('family_details.parent_occupation')} />
          <Input label="Parent Phone" {...register('family_details.parent_phone')} />
          <Input label="Parent Email" {...register('family_details.parent_email')} />
          <Input label="Parent Address" {...register('family_details.parent_address')} className="md:col-span-2" />
        </div>
        
        <h4 className="text-md font-medium mt-4 mb-2 text-gray-700">Emergency Contact</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Input label="Name" {...register('family_details.emergency_contact_name')} />
          <Input label="Phone" {...register('family_details.emergency_contact_phone')} />
          <Input label="Relation" {...register('family_details.emergency_contact_relation')} />
        </div>
      </div>
    </div>
  );
}

function AcademicHistorySection({ register, control }: any) {
  const { fields: acadFields, append: appendAcad, remove: removeAcad } = useFieldArray({ control, name: "previous_academics" });
  const { fields: extraFields, append: appendExtra, remove: removeExtra } = useFieldArray({ control, name: "extra_curricular" });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
        <h3 className="text-lg font-semibold border-b pb-2">Previous Academic History</h3>
        {acadFields.map((field: any, index: number) => (
          <div key={field.id} className="flex gap-4 mb-2 items-end flex-wrap md:flex-nowrap">
            <Select label="Level" {...register(`previous_academics.${index}.level`)} options={['SSLC', 'HSC', 'UG', 'Other']} />
            <Input label="Institution" {...register(`previous_academics.${index}.institution`)} className="flex-1 min-w-[200px]" />
            <Input label="Board/Univ" {...register(`previous_academics.${index}.board_university`)} />
            <Input label="Year" {...register(`previous_academics.${index}.year_passing`)} className="w-24" />
            <Input label="%" {...register(`previous_academics.${index}.percentage`)} className="w-20" />
            <button type="button" onClick={() => removeAcad(index)} className="p-2 text-red-500 hover:bg-red-50 rounded">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => appendAcad({ level: 'SSLC' })} className="text-sm text-blue-600 flex items-center gap-1">
          <Plus size={16} /> Add Academic Record
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
        <h3 className="text-lg font-semibold border-b pb-2">Extra Curricular Activities</h3>
        {extraFields.map((field: any, index: number) => (
          <div key={field.id} className="flex gap-4 mb-2 items-end">
            <Select label="Type" {...register(`extra_curricular.${index}.activity_type`)} options={['NCC/NSS', 'Sports', 'Fine Arts', 'Other']} />
            <Input label="Description" {...register(`extra_curricular.${index}.description`)} className="flex-1" />
            <Input label="Year" {...register(`extra_curricular.${index}.year`)} className="w-24" />
            <button type="button" onClick={() => removeExtra(index)} className="p-2 text-red-500 hover:bg-red-50 rounded">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => appendExtra({})} className="text-sm text-blue-600 flex items-center gap-1">
          <Plus size={16} /> Add Activity
        </button>
      </div>
    </div>
  );
}

function CounselorDiarySection({ register, control }: any) {
  const { fields, append, remove } = useFieldArray({ control, name: "counselor_diary" });

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
      <div className="flex justify-between items-center border-b pb-2">
        <h3 className="text-lg font-semibold">Counselor Diary</h3>
        <button type="button" onClick={() => append({ date: new Date().toISOString().split('T')[0] })} className="text-sm text-blue-600 flex items-center gap-1">
          <Plus size={16} /> Add Entry
        </button>
      </div>
      
      <div className="space-y-4">
        {fields.map((field: any, index: number) => (
          <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start border p-4 rounded-lg">
            <div className="md:col-span-2">
              <Input label="Date" type="date" {...register(`counselor_diary.${index}.date`)} />
            </div>
            <div className="md:col-span-2">
              <Input label="Category" {...register(`counselor_diary.${index}.category`)} placeholder="General" />
            </div>
            <div className="md:col-span-2">
              <Input label="Counselor" {...register(`counselor_diary.${index}.counselor_name`)} />
            </div>
            <div className="md:col-span-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <textarea 
                {...register(`counselor_diary.${index}.remarks`)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                rows={2}
              />
            </div>
            <div className="md:col-span-1 flex justify-end">
              <button type="button" onClick={() => remove(index)} className="p-2 text-red-500 hover:bg-red-50 rounded mt-6">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TestMarksSection({ register, control, setValue }: any) {
  const { fields, append, remove } = useFieldArray({ control, name: "test_marks" });

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
      <div className="flex justify-between items-center border-b pb-2">
        <h3 className="text-lg font-semibold">Internal Test Marks</h3>
        <button type="button" onClick={() => append({})} className="text-sm text-blue-600 flex items-center gap-1">
          <Plus size={16} /> Add Subject
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="px-2 py-2 text-sm font-medium text-gray-500">Sem</th>
              <th className="px-2 py-2 text-sm font-medium text-gray-500 w-1/3">Subject Code/Name</th>
              <th className="px-2 py-2 text-sm font-medium text-gray-500">Test 1</th>
              <th className="px-2 py-2 text-sm font-medium text-gray-500">Test 2</th>
              <th className="px-2 py-2 text-sm font-medium text-gray-500">Test 3</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field: any, index: number) => (
              <SubjectRow 
                key={field.id} 
                index={index} 
                register={register} 
                control={control} 
                remove={remove} 
                setValue={setValue}
                fieldName="test_marks"
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExamMarksSection({ register, control, setValue }: any) {
  const { fields, append, remove } = useFieldArray({ control, name: "exam_marks" });

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
      <div className="flex justify-between items-center border-b pb-2">
        <h3 className="text-lg font-semibold">Semester Examination Marks</h3>
        <button type="button" onClick={() => append({})} className="text-sm text-blue-600 flex items-center gap-1">
          <Plus size={16} /> Add Subject
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="px-2 py-2 text-sm font-medium text-gray-500">Sem</th>
              <th className="px-2 py-2 text-sm font-medium text-gray-500">Code</th>
              <th className="px-2 py-2 text-sm font-medium text-gray-500 w-1/4">Title</th>
              <th className="px-2 py-2 text-sm font-medium text-gray-500">Internal</th>
              <th className="px-2 py-2 text-sm font-medium text-gray-500">Marks</th>
              <th className="px-2 py-2 text-sm font-medium text-gray-500">Grade</th>
              <th className="px-2 py-2 text-sm font-medium text-gray-500">Attempt</th>
              <th className="px-2 py-2 text-sm font-medium text-gray-500">Remarks</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field: any, index: number) => (
              <ExamRow 
                key={field.id} 
                index={index} 
                register={register} 
                control={control} 
                remove={remove} 
                setValue={setValue}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Helper components for rows to handle syllabus logic

const SubjectRow = ({ index, register, control, remove, setValue, fieldName }: any) => {
  const semester = useWatch({
    control,
    name: `${fieldName}.${index}.semester`,
  });

  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);

  useEffect(() => {
    if (semester) {
      const sem = Number(semester);
      const courses = getCoursesForSemester(sem);
      setAvailableCourses(courses);
    } else {
      setAvailableCourses(getAllCourses());
    }
  }, [semester]);

  return (
    <tr>
      <td className="p-2"><Input {...register(`${fieldName}.${index}.semester`)} type="number" className="w-16" placeholder="Sem" /></td>
      <td className="p-2">
        <input 
          list={`courses-${fieldName}-${index}`} 
          {...register(`${fieldName}.${index}.subject_code_name`)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          placeholder="Select or type subject..."
        />
        <datalist id={`courses-${fieldName}-${index}`}>
          {availableCourses.map((c) => (
            <option key={c.code} value={`${c.code} - ${c.title}`} />
          ))}
        </datalist>
      </td>
      <td className="p-2"><Input {...register(`${fieldName}.${index}.test1`)} /></td>
      <td className="p-2"><Input {...register(`${fieldName}.${index}.test2`)} /></td>
      <td className="p-2"><Input {...register(`${fieldName}.${index}.test3`)} /></td>
      <td className="p-2">
        <button type="button" onClick={() => remove(index)} className="text-red-500 hover:bg-red-50 p-1 rounded">
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
};

const ExamRow = ({ index, register, control, remove, setValue }: any) => {
  const semester = useWatch({
    control,
    name: `exam_marks.${index}.semester`,
  });

  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);

  useEffect(() => {
    if (semester) {
      const sem = Number(semester);
      const courses = getCoursesForSemester(sem);
      setAvailableCourses(courses);
    } else {
      setAvailableCourses(getAllCourses());
    }
  }, [semester]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Try to find the course
    const course = availableCourses.find(c => c.code === val || `${c.code} - ${c.title}` === val);
    if (course) {
      setValue(`exam_marks.${index}.subject_code`, course.code);
      setValue(`exam_marks.${index}.subject_title`, course.title);
    } else {
      // If user typed "CODE - TITLE" manually
      const parts = val.split(' - ');
      if (parts.length > 1) {
         setValue(`exam_marks.${index}.subject_code`, parts[0]);
         setValue(`exam_marks.${index}.subject_title`, parts.slice(1).join(' - '));
      }
    }
  };

  return (
    <tr>
      <td className="p-2"><Input {...register(`exam_marks.${index}.semester`)} type="number" className="w-12" /></td>
      <td className="p-2">
        <input 
          list={`exam-courses-${index}`} 
          {...register(`exam_marks.${index}.subject_code`)}
          onChange={(e) => {
            register(`exam_marks.${index}.subject_code`).onChange(e);
            handleCodeChange(e);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          placeholder="Code"
        />
        <datalist id={`exam-courses-${index}`}>
          {availableCourses.map((c) => (
            <option key={c.code} value={c.code}>{c.title}</option>
          ))}
        </datalist>
      </td>
      <td className="p-2"><Input {...register(`exam_marks.${index}.subject_title`)} /></td>
      <td className="p-2"><Input {...register(`exam_marks.${index}.internal_marks`)} className="w-16" /></td>
      <td className="p-2"><Input {...register(`exam_marks.${index}.marks`)} className="w-12" /></td>
      <td className="p-2"><Input {...register(`exam_marks.${index}.grade`)} className="w-12" /></td>
      <td className="p-2"><Input {...register(`exam_marks.${index}.attempt`)} className="w-12" /></td>
      <td className="p-2"><Input {...register(`exam_marks.${index}.remarks`)} /></td>
      <td className="p-2">
        <button type="button" onClick={() => remove(index)} className="text-red-500 hover:bg-red-50 p-1 rounded">
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
};
